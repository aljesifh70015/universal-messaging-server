const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* CONNECT DB */
mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* HOME ROUTE */
app.get("/", (req, res) => {
  res.send("WhatsApp Clone Server Running");
});

/* SOCKET LOGIC */
const users = new Map();

io.on("connection", (socket) => {

  socket.on("register", (userId) => {
    users.set(userId, socket.id);
  });

  socket.on("send-message", (data) => {
    const receiverSocket = users.get(data.to);

    if (receiverSocket) {
      io.to(receiverSocket).emit("new-message", data);
    }
  });

  socket.on("disconnect", () => {
    for (let [user, id] of users.entries()) {
      if (id === socket.id) {
        users.delete(user);
        break;
      }
    }
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log("Server running on", PORT));
