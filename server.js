const net = require("net");

// A dynamic-sized buffer
class DynBuf {
  constructor() {
    this.data = Buffer.alloc(0);
    this.length = 0;
  }
}

// Initialize the TCPConn wrapper from a net.Socket
function soInit(socket) {
  const TCPConn = {
    socket: socket,
    err: null,
    ended: false,
    reader: null,
  };

  socket.on("data", (data) => {
    if (TCPConn.reader) {
      socket.pause();
      TCPConn.reader.resolve(data);
      TCPConn.reader = null;
    }
  });

  socket.on("end", () => {
    TCPConn.ended = true;
    if (TCPConn.reader) {
      TCPConn.reader.resolve(Buffer.from("")); // Resolve with an empty buffer to indicate EOF
      TCPConn.reader = null;
    }
  });

  socket.on("error", (err) => {
    TCPConn.err = err;
    if (TCPConn.reader) {
      TCPConn.reader.reject(err);
      TCPConn.reader = null;
    }
  });

  return TCPConn;
}

// Read from the socket

function soRead(conn) {
  console.assert(!conn.reader); // no concurrent call
  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }

    if (conn.ended) {
      resolve(Buffer.from("")); // EOF
      return;
    }

    conn.reader = { resolve, reject };
    conn.socket.resume(); // Resume the 'data' event to fulfill the promise later
  });
}

// Write to the socket
function soWrite(conn, data) {
  console.assert(data.length > 0);
  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }

    conn.socket.write(data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

//Append data to new dynmaic buff
function bufPush(buf, data) {
  const newLen = buf.length + data.length;

  console.log("New Length:", newLen);
  console.log("Buffer Length:", buf.data.length);
  if (newLen < 0) {
    // Recreate the buffer if the new length is negative
    const cap = Math.max(-newLen, 32); // Ensure the capacity is at least 32
    const grown = Buffer.alloc(cap);
    data.copy(grown, 0, 0);
    buf.data = grown;
    buf.length = data.length; // Update the buffer length
  } else {
    if (buf.data.length < newLen) {
      let cap = Math.max(buf.data.length, 32);
      console.log("Capacity:", cap);

      while (cap < newLen) {
        cap *= 2;
      }

      const grown = Buffer.alloc(cap);
      buf.data.copy(grown, 0, 0);
      buf.data = grown;
    }
    console.log("Updated Buffer Length:", buf.data.length);
    console.log("Data Length:", data.length);
    console.log("Updated Length:", buf.length);
    data.copy(buf.data, buf.length, 0);
    buf.length = newLen; // Update the buffer length
  }
}

//Remove data from the front of the dynamic buffer
function bufPop(buf, len) {
  buf.data.copyWithin(0, len, buf.length);
  buf.length -= len;
}

// Cut and return complete message from DynBuf
function cutMessage(buf) {
  const idx = buf.data.indexOf("\n");
  if (idx < 0) {
    return [null, buf]; // Not complete
  }
  const msg = Buffer.from(buf.data.subarray(0, idx + 1));
  const remainingBytes = buf.data.subarray(idx + 1);
  bufPop(buf, idx + 1);

  return [msg, remainingBytes];
}
async function newConn(socket) {
  console.log(
    "new connection is stablished",
    socket.remoteAddress,
    socket.remotePort
  );
  try {
    await serveClient(socket);
  } catch (exc) {
    console.error("exception:", exc);
  } finally {
    socket.destroy();
  }
}
async function serveClient(socket) {
  const conn = soInit(socket);
  const buf = new DynBuf();
  while (true) {
    const [msg, remainingBytes] = cutMessage(buf);
    if (!msg) {
      const data = await soRead(conn);
      bufPush(buf, data);
      if (data.length === 0) {
        return;
      }
      continue;
    }

    // Process the message and send the response
    console.log("Received message:", msg.toString());
    if (msg.toString().trim() === "quit") {
        console.log("Quit command received. Closing connection.");
        await soWrite(conn, Buffer.from("Bye.\n"));
        socket.end();
        return;
    } else {
        console.log("Echoing message:", msg.toString());
        const reply = Buffer.concat([Buffer.from("Echo: "), msg]);
        await soWrite(conn, reply);
    }
    buf.data = remainingBytes;
    buf.length = remainingBytes.length;
  }
}
let server = net.createServer({ pauseOnConnect: true });
server.on("error", (e) => {
  console.log(e);
});
server.on("connection", newConn);
server.listen({ port: 3000, host: "127.0.0.1" }, () => {
  console.log("server is listning on the desired port ");
});
