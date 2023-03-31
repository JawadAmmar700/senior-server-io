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
  socket.on("join-room", (username, room_name, roomId, userId, photoUrl) => {
    socket.join(roomId);
    const user = { userId, username, photoUrl };
    if (users.has(roomId)) {
      const roomName = users.get(roomId)[0];
      users.set(roomId, [roomName, users.get(roomId)[1].set(socket.id, user)]);
    } else {
      users.set(roomId, [room_name, new Map().set(socket.id, user)]);
    }
    socket.broadcast
      .to(roomId)
      .emit("new-user-joined", users.get(roomId)[1].get(socket.id));
    io.sockets
      .in(roomId)
      .emit("users-in-room", [...users.get(roomId)[1].values()]);
    io.sockets.in(roomId).emit("room-name", users.get(roomId)[0]);

    socket.on("userMuted", (userId) => {
      socket.broadcast
        .to(roomId)
        .emit("userMuted", users.get(roomId)[1].get(socket.id));
    });
    socket.on("userUnmuted", (userId) => {
      socket.broadcast
        .to(roomId)
        .emit("userUnmuted", users.get(roomId)[1].get(socket.id));
    });
    socket.on("userCameraOn", (userId) => {
      socket.broadcast
        .to(roomId)
        .emit("userCameraOn", users.get(roomId)[1].get(socket.id));
    });
    socket.on("userCameraOff", (userId) => {
      socket.broadcast
        .to(roomId)
        .emit("userCameraOff", users.get(roomId)[1].get(socket.id));
    });

    socket.on("disconnect", () => {
      const disconnectedUserID = users.get(roomId)[1].get(socket.id).userId;
      socket.broadcast.to(roomId).emit("user-disconnected", disconnectedUserID);
      users.get(roomId)[1].delete(socket.id);
      io.sockets
        .in(roomId)
        .emit("users-in-room", [...users.get(roomId)[1].values()]);
      if (users.get(roomId)[1].size === 0) {
        users.delete(roomId);
      }
      socket.leave(roomId);
    });
  });
});
