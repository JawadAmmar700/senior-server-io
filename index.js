require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const socket = require("socket.io");
// require("./monitor");
const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const CronParser = require("cron-parser");

const client = new PrismaClient();
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hey there!, this is a server that is used by the senior project");
});

const scheduleJobs = new Map();
function dateToCron(date) {
  const minutes = date.getMinutes();
  const hours = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // add 1 because January is 0
  const dayOfWeek = date.getDay();
  const year = date.getFullYear();

  // format into a cron expression string
  const cronExpression = `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
  return cronExpression;
}

app.post("/", (req, res) => {
  const todo = req.body;
  // calculate the time 10 minutes before todo.time
  // const scheduledTime = new Date(todo.time - 600);
  const date2 = new Date(todo.date);
  const year = date2.getFullYear();
  const month = (date2.getMonth() + 1).toString().padStart(2, "0"); // add zero-padding to month
  const day = date2.getDate().toString().padStart(2, "0"); // add zero-padding to day
  const formattedDate2 = `${year}-${month}-${day}`;

  const unixTimestamp = todo.time * 1000;
  const date = new Date(unixTimestamp - 600000);
  const timeString = date.toLocaleTimeString("en-US", {
    timeZone: "Europe/Istanbul",
    hour12: false,
  });

  const scheduledTime = new Date(`${formattedDate2}T${timeString}`);
  const cronSchedule = dateToCron(scheduledTime);

  console.log("cronSchedule", cronSchedule);

  const job = cron.schedule(
    cronSchedule,
    async () => {
      console.log("running a task once at", todo.title);

      await client.reminder.update({
        where: {
          id: todo.id,
        },
        data: {
          notificationSent: true,
        },
      });
      // destroy the job
      if (scheduleJobs.has(todo.id)) {
        console.log("destroying the job");
        scheduleJobs.get(todo.id).stop();
        scheduleJobs.delete(todo.id);
      }
    },
    {
      scheduled: false,
    }
  );

  if (!scheduleJobs.has(todo.id)) {
    scheduleJobs.set(todo.id, job);
    job.start();
  }
  res.json({
    message: "the cron is running",
  });
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
