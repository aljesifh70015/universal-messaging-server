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

let roomOwners = {};
let roomRequests = {};

io.on("connection", (socket) => {

  socket.on("create-room", (data) => {

    const room = data.room;

    roomOwners[room] = socket.id;

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    socket.join(room);
  });

  socket.on("join-request", (room) => {

    room = room?.trim();

    const owner = roomOwners[room];

    if (!owner) {
      socket.emit("request-rejected", { reason: "NO_ROOM" });
      return;
    }

    if (!roomRequests[room]) {
      roomRequests[room] = [];
    }

    roomRequests[room].push(socket.id);

    io.to(owner).emit("new-request", {
      room,
      userId: socket.id
    });
  });

  socket.on("accept-request", (data) => {

    const room = data.room;
    const userId = data.userId;

    const list = roomRequests[room];

    if (!list) return;

    const index = list.indexOf(userId);

    if (index === -1) return;

    list.splice(index, 1);

    const client = io.sockets.sockets.get(userId);

    if (client) {
      client.join(room);

      client.emit("request-accepted", { room });
    }
  });

  socket.on("reject-request", (data) => {

    const room = data.room;
    const userId = data.userId;

    const list = roomRequests[room];

    if (!list) return;

    const index = list.indexOf(userId);

    if (index === -1) return;

    list.splice(index, 1);

    io.to(userId).emit("request-rejected", { room });
  });

  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data);
  });

});

server.listen(process.env.PORT || 3000);
