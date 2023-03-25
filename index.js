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
  socket.on("join-room", (username, roomId, userId, photoUrl) => {
    socket.join(roomId);
    const user = { userId, username, photoUrl };
    users.set(socket.id, user);
    socket.broadcast.to(roomId).emit("new-user-joined", users.get(socket.id));
    io.sockets.in(roomId).emit("users-in-room", [...users.values()]);

    socket.on("disconnect", () => {
      const disconnectedUserID = users.get(socket.id).userId;
      socket.broadcast.to(roomId).emit("user-disconnected", disconnectedUserID);
      users.delete(socket.id);
      io.sockets.in(roomId).emit("users-in-room", [...users.values()]);
      socket.leave(roomId);
    });
  });
});
