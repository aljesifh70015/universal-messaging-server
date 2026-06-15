const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.get("/", (req, res) => {
  res.send("SERVER RUNNING SAFE");
});

/* =========================
   SAFE STORAGE
========================= */

let roomOwners = {};
let roomRequests = {};

/* =========================
   SOCKET
========================= */

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  /* CREATE ROOM */
  socket.on("create-room", (data = {}) => {

    const room = data.room;

    if (!room) return;

    roomOwners[room] = socket.id;

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    socket.join(room);

    console.log("ROOM CREATED:", room);
  });

  /* JOIN REQUEST */
  socket.on("join-request", (room) => {

    if (!room) return;

    const owner = roomOwners[room];

    if (!owner) {
      socket.emit("request-rejected", { reason: "ROOM_NOT_FOUND" });
      return;
    }

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    roomRequests[room].push(socket.id);

    io.to(owner).emit("new-request", {
      room: room,
      userId: socket.id
    });

    console.log("JOIN REQUEST:", room);
  });

  /* ACCEPT */
  socket.on("accept-request", (data = {}) => {

    const room = data.room;
    const userId = data.userId;

    if (!room || !userId) return;

    if (!roomRequests[room]) return;

    const index = roomRequests[room].indexOf(userId);

    if (index === -1) return;

    roomRequests[room].splice(index, 1);

    const client = io.sockets.sockets.get(userId);

    if (client) {
      client.join(room);

      client.emit("request-accepted", { room });
    }

    console.log("ACCEPTED:", userId);
  });

  /* REJECT */
  socket.on("reject-request", (data = {}) => {

    const room = data.room;
    const userId = data.userId;

    if (!room || !userId) return;

    if (!roomRequests[room]) return;

    const index = roomRequests[room].indexOf(userId);

    if (index === -1) return;

    roomRequests[room].splice(index, 1);

    io.to(userId).emit("request-rejected", { room });

    console.log("REJECTED:", userId);
  });

  /* MESSAGE */
  socket.on("send-message", (data = {}) => {

    if (!data.room || !data.message) return;

    io.to(data.room).emit("receive-message", data);
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("SERVER RUNNING ON PORT:", PORT);
});
