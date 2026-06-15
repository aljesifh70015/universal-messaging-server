const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messenger Server - FINAL LEVEL 3");
});

/* =========================
   STORAGE
========================= */

let roomOwners = {};
let requestQueue = {};
let onlineUsers = {};
let messages = [];

/* =========================
   TTL (AUTO DELETE)
========================= */

function getTTL(type) {
  switch (type) {
    case "1 Day": return 24 * 60 * 60 * 1000;
    case "1 Week": return 7 * 24 * 60 * 60 * 1000;
    case "2 Weeks": return 14 * 24 * 60 * 60 * 1000;
    case "1 Month": return 30 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

/* =========================
   SOCKET CONNECTION
========================= */

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  /* =========================
     ONLINE SYSTEM
  ========================= */

  socket.on("user-online", (userId) => {
    onlineUsers[userId] = socket.id;
    io.emit("online-users", Object.keys(onlineUsers));
  });

  socket.on("disconnect", () => {
    for (let u in onlineUsers) {
      if (onlineUsers[u] === socket.id) {
        delete onlineUsers[u];
        break;
      }
    }
    io.emit("online-users", Object.keys(onlineUsers));
  });

  /* =========================
     ROOM SYSTEM
  ========================= */

  socket.on("create-room", (data) => {
    const room = data.room;

    socket.join(room);
    roomOwners[room] = socket.id;

    if (!requestQueue[room]) {
      requestQueue[room] = [];
    }

    console.log("Room created:", room);
  });

  socket.on("join-request", (room) => {
    const owner = roomOwners[room];
    if (!owner) return;

    if (!requestQueue[room]) requestQueue[room] = [];

    requestQueue[room].push(socket.id);

    io.to(owner).emit("new-request", room);
  });

  socket.on("accept-request", (room) => {
    const queue = requestQueue[room];
    if (!queue || queue.length === 0) return;

    const user = queue.shift();

    io.sockets.sockets.get(user)?.join(room);

    io.to(user).emit("request-accepted", room);
  });

  socket.on("reject-request", (room) => {
    const queue = requestQueue[room];
    if (!queue || queue.length === 0) return;

    const user = queue.shift();

    io.to(user).emit("request-rejected", room);
  });

  /* =========================
     MESSAGE SYSTEM + BLUE TICK
  ========================= */

  socket.on("send-message", (data) => {

    const msg = {
      id: Date.now(),
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      status: "sent",
      timestamp: Date.now(),
      ttl: getTTL(data.expiry || "1 Month")
    };

    messages.push(msg);

    // DELIVERED (✔✔)
    io.to(data.room).emit("receive-message", msg);
  });

  /* =========================
     SEEN SYSTEM (BLUE TICK)
  ========================= */

  socket.on("message-seen", (msgId) => {

    messages = messages.map(m => {
      if (m.id === msgId) {
        m.status = "seen"; // 🔵🔵
      }
      return m;
    });

    io.emit("message-seen-update", msgId);
  });

  /* =========================
     TYPING SYSTEM
  ========================= */

  socket.on("typing", (data) => {
    socket.to(data.room).emit("user-typing", data.userId);
  });

  socket.on("stop-typing", (data) => {
    socket.to(data.room).emit("user-stop-typing", data.userId);
  });

});

/* =========================
   AUTO CLEAN MESSAGES
========================= */

setInterval(() => {
  const now = Date.now();

  messages = messages.filter(m => (now - m.timestamp) < m.ttl);

}, 30000);

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
