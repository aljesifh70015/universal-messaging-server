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
  console.log("User connected:", socket.id);

  // Join room directly (owner or accepted user)
  socket.on("join-room", (room) => {
    socket.join(room);
    console.log(`Joined room: ${room}`);
  });

  // Send join request
  socket.on("join-request", (room) => {
    pendingRequests[room] = socket.id;

    // send request to room (owner side)
    io.to(room).emit("new-request", room);
  });

  // Accept request
  socket.on("accept-request", (room) => {
    const requester = pendingRequests[room];

    if (requester) {
      io.sockets.sockets.get(requester)?.join(room);
      io.to(requester).emit("request-accepted", room);

      delete pendingRequests[room];
    }
  });

  // ❌ Reject request
  socket.on("reject-request", (room) => {
    const requester = pendingRequests[room];

    if (requester) {
      io.to(requester).emit("request-rejected", room);
      delete pendingRequests[room];
    }
  });

  // Message send
  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
