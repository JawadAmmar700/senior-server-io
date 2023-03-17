require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const socket = require("socket.io");

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use(cors({ origin: process.env.CLIENT_APP, optionsSuccessStatus: 200 }));

const server = app.listen(process.env.PORT || 4000);

const io = socket(server, {
  cors: {
    origin: process.env.CLIENT_APP,
    methods: ["GET", "POST"],
  },
});

const users = new Map();

io.on("connection", (socket) => {
  console.log("connected");

  socket.on("join-room", (roomId) => {
    console.log("new user joined room", roomId);
    socket.join(roomId);
    users.set(socket.id, { userId: socket.id, roomId });
    socket.broadcast
      .to(roomId)
      .emit("user-connected", JSON.stringify(users.get(socket.id)));

    socket.on("disconnect-user", () => {
      console.log("user disconnected");
      socket.broadcast
        .to(roomId)
        .emit("user-disconnected", users.get(socket.id));
    });
    users.delete(socket.id);
  });
});
