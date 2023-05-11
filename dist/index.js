"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const app = (0, express_1.default)();
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const room_1 = require("./lib/room");
app.use((0, cors_1.default)({ origin: process.env.CLIENT_APP, optionsSuccessStatus: 200 }));
app.get("/", (_, res) => {
    res.send("Hey there!, this is a socket and rooms managment system server for the meetly-omega.vercel.app");
});
const server = app.listen(process.env.PORT || 4000);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.CLIENT_APP,
        methods: ["GET", "POST"],
    },
});
const rooms = new room_1.Rooms({ io });
io.on("connection", (socket) => {
    socket.on("join-room", (username, room_name, roomId, userId, photoUrl, email) => {
        const room = rooms.createRoom(room_name, roomId);
        room.addUser(socket, { userId, username, photoUrl, email });
        socket.on("user-operation", (userId, op) => room.emitUserOperation(socket, userId, op));
        socket.on("streams", () => room.emitStreams());
        socket.on("chat-message", (message) => {
            room.emitChatMessage(socket, message);
        });
        socket.on("disconnect", () => room.removeUser(socket));
    });
});
//# sourceMappingURL=index.js.map