const net = require("net");

function newConn(socket) {
  console.log(
    "new connection is stablished",
    socket.remoteAddress, socket.remotePort
  );

  socket.on("end", () => {
    // fin is send
    console.log("EOF");
  });

  socket.on('data', (data) => {
    console.log("data", data);
    socket.write(data);


    if(data.includes('q')){
        console.log('wrong way ending the progeamm');
        socket.end();
    }
  });
}

let server = net.createServer();
server.on("error", (e) => {
  console.log(e);
});
server.on("connection", newConn);
server.listen({ port: 3000, host: "127.0.0.1" }, () => {
  console.log("server is listning on the desired port ");
});
