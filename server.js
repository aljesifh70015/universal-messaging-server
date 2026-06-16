const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.send("SERVER RUNNING OK");
});

/* ======================
   MEMORY STORAGE
====================== */
const users = new Map(); // userId -> socketId

/* ======================
   SOCKET CONNECTION
====================== */
io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  /* USER REGISTER */
  socket.on("register", (userId) => {
    if (!userId) return;
    users.set(userId, socket.id);
  });

  /* JOIN ROOM (PRIVATE CHAT) */
  socket.on("join", (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
  });

  /* SEND MESSAGE */
  socket.on("message", (data = {}) => {
    if (!data.roomId || !data.message) return;

    io.to(data.roomId).emit("message", {
      sender: data.sender,
      message: data.message,
      time: new Date().toLocaleTimeString()
    });
  });

  /* TYPING */
  socket.on("typing", (roomId) => {
    socket.to(roomId).emit("typing");
  });

  socket.on("stopTyping", (roomId) => {
    socket.to(roomId).emit("stopTyping");
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {
    for (let [userId, id] of users.entries()) {
      if (id === socket.id) {
        users.delete(userId);
        break;
      }
    }
  });

});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
