const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server Running (Stable Version)");
});

// 🔥 ROOM OWNERS MAP
let roomOwners = {};

// 🔥 MESSAGE STORAGE WITH TTL
let messages = [];

/*
MESSAGE STRUCTURE:
{
  room,
  message,
  senderId,
  timestamp,
  ttl
}
*/

// 🔥 TTL SETTINGS
function getTTL(type) {
  switch (type) {
    case "1 Day":
      return 1 * 24 * 60 * 60 * 1000;
    case "1 Week":
      return 7 * 24 * 60 * 60 * 1000;
    case "2 Weeks":
      return 14 * 24 * 60 * 60 * 1000;
    case "1 Month":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 30 * 24 * 60 * 60 * 1000;
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 🔥 CREATE ROOM
  socket.on("create-room", (data) => {
    const room = data.room;

    socket.join(room);

    // owner mapping
    roomOwners[room] = socket.id;

    console.log("Room created:", room);
  });

  // 🔥 JOIN ROOM
  socket.on("join-room", (room) => {
    socket.join(room);
  });

  // 🔥 JOIN REQUEST (FIXED)
  socket.on("join-request", (room) => {
    const ownerSocketId = roomOwners[room];

    if (ownerSocketId) {
      io.to(ownerSocketId).emit("new-request", room);
    } else {
      console.log("No owner found for room:", room);
    }
  });

  // 🔥 ACCEPT REQUEST
  socket.on("accept-request", (room) => {
    socket.join(room);
    io.to(socket.id).emit("request-accepted", room);
  });

  // 🔥 REJECT REQUEST
  socket.on("reject-request", (room) => {
    io.to(socket.id).emit("request-rejected", room);
  });

  // 🔥 SEND MESSAGE (WITH TTL)
  socket.on("send-message", (data) => {
    const ttl = getTTL(data.expiry || "1 Month");

    const msg = {
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      timestamp: Date.now(),
      ttl: ttl
    };

    messages.push(msg);

    io.to(data.room).emit("receive-message", msg);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// 🔥 AUTO DELETE EXPIRED MESSAGES ONLY
setInterval(() => {
  const now = Date.now();

  const before = messages.length;

  messages = messages.filter(msg => {
    return (now - msg.timestamp) < msg.ttl;
  });

  const deleted = before - messages.length;

  if (deleted > 0) {
    console.log(`Deleted ${deleted} expired messages`);
  }

}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
