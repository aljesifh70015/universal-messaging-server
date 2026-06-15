const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("ENHANCED UNIVERSAL SERVER RUNNING");
});

/* =========================
   STORAGE SYSTEM
========================= */

let roomOwners = {};
let roomRequests = {};
let onlineUsers = {};

/* =========================
   SOCKET CONNECTION
========================= */

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  /* =========================
     ONLINE TRACKING (FIXED)
  ========================= */

  socket.on("user-online", (userId) => {
    socket.userId = userId;
    onlineUsers[userId] = socket.id;

    io.emit("online-users", Object.keys(onlineUsers));
  });

  /* =========================
     DISCONNECT CLEANUP (IMPORTANT FIX)
  ========================= */

  socket.on("disconnect", () => {
    if (socket.userId) {
      delete onlineUsers[socket.userId];
      io.emit("online-users", Object.keys(onlineUsers));
    }
  });

  /* =========================
     CREATE ROOM (SAFE)
  ========================= */

  socket.on("create-room", (data) => {
    const room = data.room;

    if (!room) return;

    roomOwners[room] = socket.id;

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    socket.join(room);

    console.log("ROOM CREATED:", room);
  });

  /* =========================
     JOIN REQUEST (SAFE + LOGGED)
  ========================= */

  socket.on("join-request", (room) => {

    const ownerSocket = roomOwners[room];

    if (!ownerSocket) {
      socket.emit("request-rejected", { reason: "ROOM_NOT_FOUND" });
      return;
    }

    if (!roomRequests[room]) roomRequests[room] = [];

    roomRequests[room].push(socket.id);

    io.to(ownerSocket).emit("new-request", {
      room: room,
      userId: socket.id
    });
  });

  /* =========================
     ACCEPT REQUEST (FIXED QUEUE)
  ========================= */

  socket.on("accept-request", (data) => {

    const room = data.room;

    const userSocket = roomRequests[room]?.shift();

    if (!userSocket) return;

    const clientSocket = io.sockets.sockets.get(userSocket);

    if (clientSocket) {
      clientSocket.join(room);

      clientSocket.emit("request-accepted", {
        room: room,
        status: "accepted"
      });
    }
  });

  /* =========================
     REJECT REQUEST
  ========================= */

  socket.on("reject-request", (data) => {

    const room = data.room;

    const userSocket = roomRequests[room]?.shift();

    if (!userSocket) return;

    io.to(userSocket).emit("request-rejected", {
      room: room,
      status: "rejected"
    });
  });

  /* =========================
     MESSAGE SYSTEM (IMPROVED)
  ========================= */

  socket.on("send-message", (data) => {

    if (!data.room || !data.message) return;

    const messagePacket = {
      id: Date.now(),
      room: data.room,
      message: data.message,
      senderId: data.senderId,
      timestamp: new Date().toISOString()
    };

    io.to(data.room).emit("receive-message", messagePacket);
  });

  /* =========================
     ERROR HANDLER (NEW)
  ========================= */

  socket.on("error", (err) => {
    console.log("Socket Error:", err);
  });

});

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT:", PORT);
});
