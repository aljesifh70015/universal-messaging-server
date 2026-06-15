const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* =========================
   BASIC SERVER
========================= */

app.get("/", (req, res) => {
  res.send("UNIVERSAL CHAT SERVER RUNNING");
});

/* =========================
   STORAGE (MERGED SYSTEM)
========================= */

let roomOwners = {};     // room → owner socket
let roomRequests = {};   // room → queue of users
let onlineUsers = {};    // userId → socketId

/* =========================
   SOCKET MAIN
========================= */

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  /* =========================
     USER ONLINE
  ========================= */

  socket.on("user-online", (userId) => {
    socket.userId = userId;
    onlineUsers[userId] = socket.id;

    io.emit("online-users", Object.keys(onlineUsers));
  });

  /* =========================
     CREATE ROOM
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
     JOIN REQUEST
  ========================= */

  socket.on("join-request", (room) => {

    console.log("JOIN REQUEST:", room);

    const ownerSocket = roomOwners[room];

    if (!ownerSocket) {
      socket.emit("request-rejected", {
        reason: "ROOM_NOT_FOUND"
      });
      return;
    }

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    roomRequests[room].push(socket.id);

    console.log("REQUEST QUEUE:", roomRequests);

    io.to(ownerSocket).emit("new-request", {
      room: room,
      userId: socket.id
    });
  });

  /* =========================
     ACCEPT REQUEST
  ========================= */

  socket.on("accept-request", (data) => {

    console.log("ACCEPT:", data);

    const room = data.room;

    const userSocket = roomRequests[room]?.shift();

    if (!userSocket) return;

    const client = io.sockets.sockets.get(userSocket);

    if (client) {
      client.join(room);

      client.emit("request-accepted", {
        room: room
      });
    }
  });

  /* =========================
     REJECT REQUEST
  ========================= */

  socket.on("reject-request", (data) => {

    console.log("REJECT:", data);

    const room = data.room;

    const userSocket = roomRequests[room]?.shift();

    if (!userSocket) return;

    io.to(userSocket).emit("request-rejected", {
      room: room
    });
  });

  /* =========================
     MESSAGE SYSTEM
  ========================= */

  socket.on("send-message", (data) => {

    if (!data.room || !data.message) return;

    io.to(data.room).emit("receive-message", {
      id: Date.now(),
      message: data.message,
      senderId: data.senderId
    });
  });

  /* =========================
     DISCONNECT CLEANUP
  ========================= */

  socket.on("disconnect", () => {

    if (socket.userId) {
      delete onlineUsers[socket.userId];
      io.emit("online-users", Object.keys(onlineUsers));
    }

    console.log("DISCONNECTED:", socket.id);
  });

});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT:", PORT);
});
