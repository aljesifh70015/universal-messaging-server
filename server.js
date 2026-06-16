const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

app.get("/", (req, res) => {
  res.send("CHAT SERVER RUNNING");
});

/* =========================
   MONGODB CONNECTION
========================= */
mongoose.connect("mongodb+srv://aljesif:<db_password>@cluster0.t7kihvt.mongodb.net/?appName=Cluster0");

/* =========================
   USER MODEL
========================= */
const User = mongoose.model("User", {
  userId: String,
  username: String,
  password: String
});

/* =========================
   MESSAGE MODEL
========================= */
const Message = mongoose.model("Message", {
  roomId: String,
  senderId: String,
  message: String,
  time: String,
  status: String
});

/* =========================
   ONLINE USERS
========================= */
let onlineUsers = {};

/* =========================
   SOCKET LOGIC
========================= */
io.on("connection", (socket) => {

  // LOGIN / ONLINE
  socket.on("user-online", (userId) => {
    onlineUsers[userId] = socket.id;

    io.emit("user-status", {
      userId,
      status: "online"
    });
  });

  // START CHAT (auto room)
  socket.on("start-chat", ({ from, to }) => {
    const roomId = [from, to].sort().join("_");

    socket.join(roomId);

    socket.emit("chat-ready", { roomId });
  });

  // SEND MESSAGE
  socket.on("send-message", async (data) => {

    const msg = new Message({
      roomId: data.roomId,
      senderId: data.senderId,
      message: data.message,
      time: new Date().toLocaleTimeString(),
      status: "sent"
    });

    await msg.save();

    io.to(data.roomId).emit("receive-message", msg);

    // DELIVERED
    io.to(data.roomId).emit("message-status", {
      messageId: msg._id,
      status: "delivered"
    });
  });

  // SEEN
  socket.on("message-seen", async ({ messageId }) => {
    await Message.findByIdAndUpdate(messageId, { status: "seen" });

    io.emit("message-status", {
      messageId,
      status: "seen"
    });
  });

  // CHAT LIST LOAD
  socket.on("get-chats", async (userId) => {

    const chats = await Message.find({ senderId: userId });

    socket.emit("chat-list", chats);
  });

  // OFFLINE
  socket.on("disconnect", () => {
    for (let id in onlineUsers) {
      if (onlineUsers[id] === socket.id) {
        delete onlineUsers[id];

        io.emit("user-status", {
          userId: id,
          status: "offline"
        });
      }
    }
  });

});

server.listen(3000, () => console.log("Server Running"));
