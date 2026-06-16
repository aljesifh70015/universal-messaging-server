const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.get("/", (req, res) => {
  res.send("SERVER RUNNING");
});

let onlineUsers = {};

io.on("connection", (socket) => {

  // USER ONLINE
  socket.on("user-online", (userId) => {
    onlineUsers[userId] = socket.id;

    socket.broadcast.emit("user-status", {
      userId,
      status: "online"
    });
  });

  // START CHAT (WhatsApp style)
  socket.on("start-chat", ({ from, to }) => {
    const roomId = [from, to].sort().join("_");
    socket.join(roomId);

    socket.emit("chat-ready", { roomId });
  });

  // SEND MESSAGE
  socket.on("send-message", (data) => {

    const msg = {
      messageId: Date.now().toString(),
      roomId: data.roomId,
      message: data.message,
      senderId: data.senderId,
      time: new Date().toLocaleTimeString(),
      status: "sent"
    };

    io.to(data.roomId).emit("receive-message", msg);

    io.to(data.roomId).emit("message-status", {
      messageId: msg.messageId,
      status: "delivered"
    });
  });

  // SEEN
  socket.on("message-seen", (data) => {
    io.to(data.roomId).emit("message-status", {
      messageId: data.messageId,
      status: "seen"
    });
  });

  // TYPING
  socket.on("typing", (data) => {
    socket.to(data.roomId).emit("typing", data);
  });

  socket.on("stop-typing", (data) => {
    socket.to(data.roomId).emit("stop-typing");
  });

  // OFFLINE
  socket.on("disconnect", () => {
    for (let id in onlineUsers) {
      if (onlineUsers[id] === socket.id) {
        delete onlineUsers[id];

        socket.broadcast.emit("user-status", {
          userId: id,
          status: "offline"
        });
      }
    }
  });

});

server.listen(process.env.PORT || 3000);
