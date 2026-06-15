const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
cors: { origin: "*" }
});

/* =========================
MONGODB
========================= */

const uri = "mongodb+srv://aljesif:<db_password>@cluster0.t7kihvt.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri);

let db;
let usersCollection;
let messagesCollection;

async function connectDB() {
try {
await client.connect();

db = client.db("universal_chat");
usersCollection = db.collection("users");
messagesCollection = db.collection("messages");

console.log("MongoDB Connected ✅");

} catch (err) {
console.log("MongoDB Error:", err);
}
}

connectDB();

/* =========================
EXPRESS
========================= */

app.get("/", (req, res) => {
res.send("SERVER RUNNING");
});

let roomOwners = {};
let roomRequests = {};

/* =========================
SOCKET
========================= */

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

const clientSocket = io.sockets.sockets.get(userId);

if (clientSocket) {
  clientSocket.join(room);
  clientSocket.emit("request-accepted", { room });
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

socket.on("send-message", async (data) => {
io.to(data.room).emit("receive-message", data);

try {
  await messagesCollection.insertOne({
    room: data.room,
    message: data.message,
    senderId: data.senderId,
    createdAt: new Date()
  });
} catch (err) {
  console.log("Message Save Error:", err);
}

});
});

server.listen(process.env.PORT || 3000, () => {
console.log("Server running...");
});
