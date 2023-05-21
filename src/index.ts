import dotenv from "dotenv";
dotenv.config();
import express from "express";
const app = express();
import cors from "cors";
import { Server } from "socket.io";
import { Rooms } from "./lib/room";

app.use(cors({ origin: process.env.CLIENT_APP, optionsSuccessStatus: 200 }));

app.get("/", (_, res) => {
  res.send(
    "Hey there!, this is a socket and rooms managment system server for the meetly-omega.vercel.app"
  );
});

const server = app.listen(process.env.PORT || 4000);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_APP,
    methods: ["GET", "POST"],
  },
});

const rooms = new Rooms({ io });
io.on("connection", (socket) => {
  socket.on(
    "join-room",
    (username, room_name, roomId, userId, photoUrl, email, isRoomCreator) => {
      const room = rooms.createRoom(room_name, roomId);
      room.addUser(
        socket,
        {
          userId,
          username,
          photoUrl,
          email,
          isCamera: false,
          isMic: false,
          isScreenShare: false,
          joinedAt: room.dateToString(),
        },
        isRoomCreator
      );
      socket.on("user-operation", (userId, op) =>
        room.emitUserOperation(socket, userId, op)
      );
      socket.on("streams", () => room.emitStreams());
      socket.on("chat-message", (message) => {
        room.emitChatMessage(socket, message);
      });
      socket.on("disconnect", () => room.removeUser(socket));
    }
  );
});
