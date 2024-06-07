// this is the file which give me error Index getting negative
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
  if (buf.data.length < newLen) {
    let cap = Math.max(buf.data.length, 32);

    while (cap < newLen) {
      cap *= 2;
    }

    const grown = Buffer.alloc(cap);
    buf.data.copy(grown, 0, 0);
    buf.data = grown;
  }

  data.copy(buf.data, buf.length, 0);
  buf.length = newLen;
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
    return null; // Not complete
  }
  const msg = Buffer.from(buf.data.subarray(0, idx + 1));
  bufPop(buf, idx + 1);
  return msg;
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
    const msg = cutMessage(buf);
    if (!msg) {
      const data = await soRead(conn);
      bufPush(buf, data);
      if (data.length === 0) {
        return;
      }
      continue;
    }

    // Process the message and send the response
    if (msg.equals(Buffer.from("quit\n"))) {
      await soWrite(conn, Buffer.from("Bye.\n"));
      socket.destroy();
      return;
    } else {
      const reply = Buffer.concat([Buffer.from("Echo: "), msg]);
      await soWrite(conn, reply);
    }
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
