const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server Running (Message TTL Mode)");
});

// 🔥 ONLY messages stored with expiry
let messages = [];

/*
Message structure:
{
  room,
  message,
  senderId,
  timestamp,
  ttl
}
*/

// expiry convert
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
      return 7 * 24 * 60 * 60 * 1000;
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // room join (NO expiry logic here)
  socket.on("join-room", (room) => {
    socket.join(room);
  });

  socket.on("join-request", (room) => {
    io.to(room).emit("new-request", room);
  });

  socket.on("accept-request", (room) => {
    socket.join(room);
    io.to(socket.id).emit("request-accepted", room);
  });

  socket.on("reject-request", (room) => {
    io.to(socket.id).emit("request-rejected", room);
  });

  // 🔥 MESSAGE WITH TTL
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
    console.log("User disconnected");
  });
});

// 🔥 CLEAN OLD MESSAGES ONLY (ROOM NEVER DELETES)
setInterval(() => {
  const now = Date.now();

  const before = messages.length;

  messages = messages.filter(msg => {
    return (now - msg.timestamp) < msg.ttl;
  });

  const removed = before - messages.length;

  if (removed > 0) {
    console.log(`Deleted ${removed} expired messages`);
  }

}, 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
