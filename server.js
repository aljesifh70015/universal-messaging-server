const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Blue Tick Server Running");
});

let roomOwners = {};
let messages = [];

/* =========================
   MESSAGE STORAGE WITH STATUS
========================= */

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  /* =====================
     ROOM
  ===================== */

  socket.on("create-room", (data) => {
    const room = data.room;
    socket.join(room);
    roomOwners[room] = socket.id;
  });

  socket.on("join-request", (room) => {
    const owner = roomOwners[room];
    if (!owner) return;

    io.to(owner).emit("new-request", room);
  });

  socket.on("accept-request", (room) => {
    socket.join(room);
    io.to(socket.id).emit("request-accepted", room);
  });

  socket.on("reject-request", (room) => {
    io.to(socket.id).emit("request-rejected", room);
  });

  /* =====================
     MESSAGE SEND
  ===================== */

  socket.on("send-message", (data) => {

    const msg = {
      id: Date.now(),
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      status: "sent" // ✔
    };

    messages.push(msg);

    // delivered (✔✔)
    io.to(data.room).emit("message-delivered", msg);

    io.to(data.room).emit("receive-message", msg);
  });

  /* =====================
     SEEN SYSTEM (BLUE TICK)
  ===================== */

  socket.on("message-seen", (msgId) => {

    messages = messages.map(m => {
      if (m.id === msgId) {
        m.status = "seen"; // 🔵🔵
      }
      return m;
    });

    io.emit("message-seen-update", msgId);
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on", PORT);
});
