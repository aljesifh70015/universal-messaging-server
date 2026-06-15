const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server Running (FIXED VERSION)");
});

// 🔥 ROOM OWNER STORE
let roomOwners = {};

// 🔥 REQUEST TRACKING (IMPORTANT FIX)
let pendingRequests = {}; 
// format: { room: requesterSocketId }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 🔥 CREATE ROOM
  socket.on("create-room", (data) => {
    const room = data.room;

    socket.join(room);
    roomOwners[room] = socket.id;

    console.log("Room created:", room);
  });

  // 🔥 JOIN REQUEST
  socket.on("join-request", (room) => {
    const ownerSocketId = roomOwners[room];

    if (ownerSocketId) {
      pendingRequests[room] = socket.id;

      io.to(ownerSocketId).emit("new-request", room);
    }
  });

  // 🔥 ACCEPT REQUEST (FIXED LOGIC)
  socket.on("accept-request", (room) => {
    const requesterSocketId = pendingRequests[room];

    if (requesterSocketId) {
      // requester room join
      io.sockets.sockets.get(requesterSocketId)?.join(room);

      // notify REQUESTER (not owner)
      io.to(requesterSocketId).emit("request-accepted", room);

      delete pendingRequests[room];

      console.log("Request accepted for room:", room);
    } else {
      console.log("No pending request found for:", room);
    }
  });

  // 🔥 REJECT REQUEST (FIXED)
  socket.on("reject-request", (room) => {
    const requesterSocketId = pendingRequests[room];

    if (requesterSocketId) {
      io.to(requesterSocketId).emit("request-rejected", room);
      delete pendingRequests[room];
    }
  });

  // 🔥 MESSAGE
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
