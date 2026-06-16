const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.get("/", (req, res) => {
  res.send("SERVER RUNNING");
});

/* =========================
   USERS ONLINE STATUS
========================= */

let onlineUsers = {};

/* =========================
   SOCKET CONNECTION
========================= */

io.on("connection", (socket) => {

  // USER ONLINE
  socket.on("user-online", (userId) => {
    onlineUsers[userId] = socket.id;

    socket.broadcast.emit("user-status", {
      userId,
      status: "online"
    });
  });

  // USER START CHAT
  socket.on("start-chat", ({ from, to }) => {
    const roomId = [from, to].sort().join("_");

    socket.join(roomId);

    socket.emit("chat-ready", { roomId });
  });

  // SEND MESSAGE
  socket.on("send-message", (data) => {

    const messageData = {
      messageId: Date.now().toString(),
      roomId: data.roomId,
      message: data.message,
      senderId: data.senderId,
      time: new Date().toLocaleTimeString(),
      status: "sent"
    };

    io.to(data.roomId).emit("receive-message", messageData);

    // delivered instantly
    io.to(data.roomId).emit("message-status", {
      messageId: messageData.messageId,
      status: "delivered"
    });
  });

  // SEEN MESSAGE
  socket.on("message-seen", (data) => {
    io.to(data.roomId).emit("message-status", {
      messageId: data.messageId,
      status: "seen"
    });
  });

  // TYPING START
  socket.on("typing", (data) => {
    socket.to(data.roomId).emit("typing", {
      userId: data.userId
    });
  });

  // TYPING STOP
  socket.on("stop-typing", (data) => {
    socket.to(data.roomId).emit("stop-typing");
  });

  // DISCONNECT
  socket.on("disconnect", () => {

    for (let userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];

        socket.broadcast.emit("user-status", {
          userId,
          status: "offline"
        });

        break;
      }
    }
  });

});
