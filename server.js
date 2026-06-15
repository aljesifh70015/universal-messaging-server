const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  res.send("Universal Messaging Server (QUEUE SYSTEM)");
});

// 🔥 ROOM OWNERS
let roomOwners = {};

// 🔥 REQUEST QUEUE (IMPORTANT UPGRADE)
let requestQueue = {}; 
// format:
// {
//   roomName: [socketId1, socketId2]
// }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // CREATE ROOM
  socket.on("create-room", (data) => {
    const room = data.room;

    socket.join(room);
    roomOwners[room] = socket.id;

    requestQueue[room] = [];

    console.log("Room created:", room);
  });

  // JOIN REQUEST (QUEUE ADD)
  socket.on("join-request", (room) => {
    const owner = roomOwners[room];

    if (!owner) return;

    if (!requestQueue[room]) {
      requestQueue[room] = [];
    }

    requestQueue[room].push(socket.id);

    io.to(owner).emit("new-request", {
      room: room,
      queueSize: requestQueue[room].length
    });
  });

  // ACCEPT REQUEST (FIRST IN QUEUE)
  socket.on("accept-request", (room) => {
    const queue = requestQueue[room];

    if (queue && queue.length > 0) {
      const requester = queue.shift();

      io.sockets.sockets.get(requester)?.join(room);
      io.to(requester).emit("request-accepted", room);

      console.log("Accepted:", requester);
    }
  });

  // REJECT REQUEST (FIRST IN QUEUE)
  socket.on("reject-request", (room) => {
    const queue = requestQueue[room];

    if (queue && queue.length > 0) {
      const requester = queue.shift();

      io.to(requester).emit("request-rejected", room);

      console.log("Rejected:", requester);
    }
  });

  // MESSAGE
  socket.on("send-message", (data) => {
    io.to(data.room).emit("receive-message", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
