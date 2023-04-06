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
const usersCameraONOFF = new Map();
const usersMuted = new Map();
const usersScreenShare = new Map();
const roomNameMap = new Map();

io.on("connection", (socket) => {
  socket.on("join-room", (username, room_name, roomId, userId, photoUrl) => {
    socket.join(roomId);
    const user = { userId, username, photoUrl };
    if (users.has(roomId)) {
      const roomName = users.get(roomId)[0];
      users.set(roomId, [roomName, users.get(roomId)[1].set(socket.id, user)]);
    } else {
      if (!roomNameMap.has(roomId)) {
        roomNameMap.set(roomId, room_name);
      }
      users.set(roomId, [room_name, new Map().set(socket.id, user)]);
    }
    socket.broadcast
      .to(roomId)
      .emit("new-user-joined", users.get(roomId)[1].get(socket.id));
    io.sockets
      .in(roomId)
      .emit("users-in-room", [...users.get(roomId)[1].values()]);
    io.sockets.in(roomId).emit("room-name", roomNameMap.get(roomId));

    socket.on("streams", () => {
      io.sockets.in(roomId).emit("streams");
    });

    socket.on("user-operation", (userId, op) => {
      switch (op) {
        case "userCameraOff":
          usersCameraONOFF.set(userId, userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersCameraONOFF.values()]);
          break;
        case "userCameraOn":
          usersCameraONOFF.delete(userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersCameraONOFF.values()]);
          break;
        case "userMuted":
          usersMuted.set(userId, userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersMuted.values()]);
          break;
        case "userUnmuted":
          usersMuted.delete(userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersMuted.values()]);
          break;
        case "userScreenShareOff":
          usersScreenShare.delete(userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersScreenShare.values()]);
          break;
        case "userScreenShareOn":
          usersScreenShare.set(userId, userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersScreenShare.values()]);
          break;
        default:
          break;
      }
    });

    socket.on("disconnect", () => {
      const disconnectedUserID = users.get(roomId)[1].get(socket.id).userId;
      socket.broadcast.to(roomId).emit("user-disconnected", disconnectedUserID);
      users.get(roomId)[1].delete(socket.id);
      usersCameraONOFF.delete(disconnectedUserID);
      usersMuted.delete(disconnectedUserID);
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
