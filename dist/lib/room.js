"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rooms = void 0;
class Rooms {
    constructor(options) {
        this.rooms = new Map();
        this.io = options.io;
        this.rooms = new Map();
    }
    createRoom(name, id) {
        if (!this.rooms.has(id)) {
            this.rooms.set(id, new Room(name, id, { io: this.io }));
        }
        return this.rooms.get(id);
    }
    removeRoom(id) {
        if (this.rooms.has(id)) {
            this.rooms.delete(id);
        }
    }
}
exports.Rooms = Rooms;
class Room extends Rooms {
    constructor(room_name, id, roomsArgs) {
        super(roomsArgs);
        this.users = new Map();
        this.usersCameraOnOff = new Map();
        this.usersMuted = new Map();
        this.usersScreenShare = new Map();
        this.roomParticipants = new Map();
        this.name = room_name;
        this.id = id;
    }
    dateToString() {
        return new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "numeric",
            timeZone: "Europe/Istanbul",
        });
    }
    addParticipant(user) {
        this.roomParticipants.set(user.userId, Object.assign(Object.assign({}, user), { joinedAt: this.dateToString(), leftAt: null }));
    }
    updateParticipant(userId) {
        const participant = this.roomParticipants.get(userId);
        if (participant) {
            participant.leftAt = this.dateToString();
            this.roomParticipants.set(userId, participant);
        }
    }
    addUser(socket, user) {
        this.users.set(socket.id, Object.assign(Object.assign({}, user), { time: this.dateToString() }));
        this.addParticipant(user);
        socket.join(this.id);
        socket.broadcast
            .to(this.id)
            .emit("new-user-joined", Object.assign(Object.assign({}, user), { time: this.dateToString() }));
        this.emitUsersInRoom();
        this.emitRoomName();
        this.emitStreams();
    }
    removeUser(socket) {
        const user = this.users.get(socket.id);
        if (user) {
            const disconnectedUserID = user.userId;
            this.updateParticipant(disconnectedUserID);
            socket.broadcast.to(this.id).emit("user-disconnected", {
                username: user.username,
                userId: disconnectedUserID,
            });
            this.users.delete(socket.id);
            this.usersCameraOnOff.delete(disconnectedUserID);
            this.usersMuted.delete(disconnectedUserID);
            this.usersScreenShare.delete(disconnectedUserID);
            if (this.users.size === 0) {
                this.removeRoom(this.id);
            }
            socket.leave(this.id);
        }
    }
    emitUsersInRoom() {
        this.io.sockets.in(this.id).emit("users-in-room", [...this.users.values()]);
    }
    emitRoomName() {
        this.io.sockets.in(this.id).emit("room-name", this.name);
    }
    emitStreams() {
        this.io.sockets.in(this.id).emit("media-streams");
        this.io.sockets
            .in(this.id)
            .emit("participants", [...this.roomParticipants.values()]);
    }
    emitUserOperation(socket, userId, op) {
        socket.broadcast.to(this.id).emit("user-operation", op, userId);
    }
    emitChatMessage(socket, message) {
        socket.broadcast.to(this.id).emit("chat-message", message);
    }
}
//# sourceMappingURL=room.js.map