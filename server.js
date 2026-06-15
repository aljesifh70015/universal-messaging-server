const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("FIXED CHAT SERVER");
});

/* =========================
   STORAGE
========================= */

let roomOwners = {};
let roomRequests = {}; // store full objects now

/* =========================
   SOCKET
========================= */

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  /* =========================
     CREATE ROOM
  ========================= */

  socket.on("create-room", (data) => {
    const room = data.room;

    roomOwners[room] = socket.id;

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    socket.join(room);

    console.log("ROOM CREATED:", room);
  });

  /* =========================
     JOIN REQUEST (FIXED)
  ========================= */

  socket.on("join-request", (room) => {

    const ownerSocket = roomOwners[room];

    if (!ownerSocket) {
      socket.emit("request-rejected", {
        reason: "ROOM_NOT_FOUND"
      });
      return;
    }

    // 🔥 DO NOT SHIFT ANYTHING HERE
    roomRequests[room].push({
      userSocket: socket.id,
      room: room
    });

    console.log("REQUEST STORED:", roomRequests);

    io.to(ownerSocket).emit("new-request", {
      room: room,
      userId: socket.id
    });
  });

  /* =========================
     ACCEPT REQUEST (FIXED)
  ========================= */

  socket.on("accept-request", (data) => {

    const room = data.room;

    const index = roomRequests[room]
      .findIndex(r => r.userSocket === data.userId);

    if (index === -1) return;

    const userSocket = roomRequests[room][index].userSocket;

    roomRequests[room].splice(index, 1);

    const client = io.sockets.sockets.get(userSocket);

    if (client) {
      client.join(room);

      client.emit("request-accepted", {
        room: room
      });
    }

    console.log("ACCEPTED:", userSocket);
  });

  /* =========================
     REJECT REQUEST (FIXED)
  ========================= */

  socket.on("reject-request", (data) => {

    const room = data.room;

    const index = roomRequests[room]
      .findIndex(r => r.userSocket === data.userId);

    if (index === -1) return;

    const userSocket = roomRequests[room][index].userSocket;

    roomRequests[room].splice(index, 1);

    io.to(userSocket).emit("request-rejected", {
      room: room
    });

    console.log("REJECTED:", userSocket);
  });

  /* =========================
     MESSAGE
  ========================= */

  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data);
  });

});
