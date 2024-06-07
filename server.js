const net = require("net");
const { resolve } = require("path");
//  A wrapper object for TCP sockets
const TCPConn = {
    socket:null,
    err:null,
    ended:false,
    reader:null,
};

// Initialize the TCPConn wrapper from a net.Socket

function soInit(socket){
    TCPConn.socket = socket;
    TCPConn.err  = null;
    TCPConn.ended = false;
    TCPConn.reader = null;

    socket.on('data', (data)=>{
        if(TCPConn.reader){
            socket.pause();
            TCPConn.reader.resolve(data);
            TCPConn.reader = null;
        }
    });

    socket.on('end' , ()=>{
        TCPConn.ended = true;
        if(TCPConn.reader){
            TCPConn.reader.resolve(Buffer.from('')); // Resolve with an empty buffer to indicate EOF
            TCPConn.reader = null;
        }
    });

    socket.on('error', (err) => {
        TCPConn.err = err;
        if (TCPConn.reader) {
            TCPConn.reader.reject(err);
            TCPConn.reader = null;
        }
    });


    return TCPConn;
}


// Read from the socket

function soRead(conn){
    console.assert(!conn.reader); // no concurrent call
    return new Promise((resolve , reject)=>{
        if(conn.err){
            reject(conn.err);
            return;
        }

        if(conn.ended){
            resolve(Buffer.from('')); // EOF
            return;
        }

        conn.reader = { resolve , reject};
        conn.socket.resume() ;// Resume the 'data' event to fulfill the promise later
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



 async function newConn(socket) {
  console.log(
    "new connection is stablished",
    socket.remoteAddress, socket.remotePort
  );
  try{
    await serveClient(socket);
  }
  catch(exc){
    
    console.error('exception:', exc);
    
  }
  finally{
    socket.destroy();
  }
}
async function serveClient(socket){
    const conn = soInit(socket);
    while(true){
        const data = await soRead(conn);
        if(data.length === 0){
            console.log('end connection');
            break;
        }


        console.log('data' , data);
        await soWrite(conn , data);
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
