require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const socket = require("socket.io");
const { createCronJob, createCronJobToMarkAsDone } = require("./lib/cron-job");

app.use(bodyParser.json());
app.use(cors({ origin: process.env.CLIENT_APP, optionsSuccessStatus: 200 }));

app.get("/", (req, res) => {
  res.send("Hey there!, this is a server that is used by the senior project");
});

app.post("/cron-job", async (req, res) => {
  const { todo } = req.body;
  await createCronJob(todo);
  await createCronJobToMarkAsDone(todo);

  res.json({
    message: "The cron Job is created successfully",
  });
});

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
      users.set(roomId, users.get(roomId).set(socket.id, user));
    } else {
      if (!roomNameMap.has(roomId)) {
        roomNameMap.set(roomId, room_name);
      }
      users.set(roomId, new Map().set(socket.id, user));
    }
    socket.broadcast
      .to(roomId)
      .emit("new-user-joined", users.get(roomId).get(socket.id));
    io.sockets
      .in(roomId)
      .emit("users-in-room", [...users.get(roomId).values()]);
    io.sockets.in(roomId).emit("room-name", roomNameMap.get(roomId));

    socket.on("streams", () => {
      io.sockets.in(roomId).emit("streams");
    });
    io.sockets.in(roomId).emit("get-users-muted", [...usersMuted.values()]);

    io.sockets
      .in(roomId)
      .emit("get-users-cameraOnOff", [...usersCameraONOFF.values()]);
    io.sockets
      .in(roomId)
      .emit("get-users-shareScreen", [...usersScreenShare.values()]);

    socket.on("user-operation", (userId, isTrue, op) => {
      switch (op) {
        case "userCameraOnOff":
          isTrue
            ? usersCameraONOFF.delete(userId)
            : usersCameraONOFF.set(userId, userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersCameraONOFF.values()]);
          break;

        case "userMuted":
          isTrue ? usersMuted.set(userId, userId) : usersMuted.delete(userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersMuted.values()]);
          break;

        case "userScreenShare":
          isTrue
            ? usersScreenShare.set(userId, userId)
            : usersScreenShare.delete(userId);
          socket.broadcast
            .to(roomId)
            .emit("user-operation", userId, op, [...usersScreenShare.values()]);
          break;

        default:
          break;
      }
    });

    socket.on("chat-message", (message) => {
      socket.broadcast.to(roomId).emit("chat-message", message);
    });

    socket.on("disconnect", () => {
      if (users.has(roomId) && users.get(roomId).get(socket.id)) {
        const disconnectedUserID = users.get(roomId).get(socket.id).userId;
        socket.broadcast
          .to(roomId)
          .emit("user-disconnected", disconnectedUserID);
        users.get(roomId).delete(socket.id);
        usersCameraONOFF.delete(disconnectedUserID);
        usersMuted.delete(disconnectedUserID);
        usersScreenShare.delete(disconnectedUserID);
        if (users.get(roomId).size === 0) {
          users.delete(roomId);
          usersCameraONOFF.clear();
          usersMuted.clear();
          usersScreenShare.clear();
          roomNameMap.clear();
        }
        socket.leave(roomId);
      }
    });
  });
});
