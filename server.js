const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server - FINAL CLEAN VERSION");
});

/* =======================
   STORAGE
======================= */

let roomOwners = {};
let requestQueue = {};
let onlineUsers = {};
let messages = [];

/* =======================
   TTL FUNCTION
======================= */

function getTTL(type) {
  switch (type) {
    case "1 Day": return 24 * 60 * 60 * 1000;
    case "1 Week": return 7 * 24 * 60 * 60 * 1000;
    case "2 Weeks": return 14 * 24 * 60 * 60 * 1000;
    case "1 Month": return 30 * 24 * 60 * 60 * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

/* =======================
   SOCKET
======================= */

io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  /* -------- ONLINE -------- */
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

  /* -------- ROOM -------- */
  socket.on("create-room", (data) => {
    const room = data.room;

    socket.join(room);
    roomOwners[room] = socket.id;

    if (!requestQueue[room]) requestQueue[room] = [];

    console.log("Room created:", room);
  });

  /* -------- JOIN REQUEST -------- */
  socket.on("join-request", (room) => {
    const owner = roomOwners[room];
    if (!owner) return;

    requestQueue[room].push(socket.id);

    io.to(owner).emit("new-request", {
      room: room,
      total: requestQueue[room].length
    });
  });

  /* -------- ACCEPT -------- */
  socket.on("accept-request", (room) => {
    const queue = requestQueue[room];
    if (!queue || queue.length === 0) return;

    const user = queue.shift();

    io.sockets.sockets.get(user)?.join(room);
    io.to(user).emit("request-accepted", room);
  });

  /* -------- REJECT -------- */
  socket.on("reject-request", (room) => {
    const queue = requestQueue[room];
    if (!queue || queue.length === 0) return;

    const user = queue.shift();
    io.to(user).emit("request-rejected", room);
  });

  /* -------- MESSAGE -------- */
  socket.on("send-message", (data) => {

    const msg = {
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      timestamp: Date.now(),
      ttl: getTTL(data.expiry || "1 Month")
    };

    messages.push(msg);

    io.to(data.room).emit("receive-message", msg);
  });

  /* -------- TYPING -------- */
  socket.on("typing", (data) => {
    socket.to(data.room).emit("user-typing", data.userId);
  });

  socket.on("stop-typing", (data) => {
    socket.to(data.room).emit("user-stop-typing", data.userId);
  });

});

/* =======================
   CLEANUP
======================= */

setInterval(() => {
  const now = Date.now();

  messages = messages.filter(m => (now - m.timestamp) < m.ttl);

}, 30000);

/* =======================
   START
======================= */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
