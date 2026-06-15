const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server Running");
});

let pendingRequests = {};

io.on("connection", (socket) => {
  console.log("User connected");

  socket.on("join-request", (room) => {
    pendingRequests[room] = socket.id;
    io.to(room).emit("new-request", room);
  });

  socket.on("accept-request", (room) => {
    const requester = pendingRequests[room];

    if (requester) {
      io.sockets.sockets.get(requester)?.join(room);
      io.to(requester).emit("request-accepted", room);
      delete pendingRequests[room];
    }
  });

  socket.on("join-room", (room) => {
    socket.join(room);
  });

  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
