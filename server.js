const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server Running");
});

// Store messages with timestamp
let messages = [];

// Helper: check expiry
function isExpired(timestamp, expiryMs) {
  return Date.now() - timestamp > expiryMs;
}

// cleanup job (runs every 10 sec)
setInterval(() => {
  const now = Date.now();

  // default expiry = 1 month (you can change per message later)
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

  messages = messages.filter(msg => {
    return !isExpired(msg.timestamp, ONE_MONTH);
  });

}, 10000);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

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

  // 💥 MESSAGE WITH TIMESTAMP
  socket.on("send-message", (data) => {
    const msgObj = {
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      timestamp: Date.now()
    };

    messages.push(msgObj);

    io.to(data.room).emit("receive-message", msgObj);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
