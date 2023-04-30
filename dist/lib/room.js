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
        this.name = room_name;
        this.id = id;
    }
    addUser(socket, user) {
        this.users.set(socket.id, user);
        socket.join(this.id);
        socket.broadcast.to(this.id).emit("new-user-joined", user);
        this.emitUsersInRoom();
        this.emitRoomName();
        this.emitStreams();
        this.emitUsersMuted();
        this.emitUsersCameraOnOff();
        this.emitUsersScreenShare();
    }
    removeUser(socket) {
        const user = this.users.get(socket.id);
        if (user) {
            const disconnectedUserID = user.userId;
            socket.broadcast
                .to(this.id)
                .emit("user-disconnected", disconnectedUserID);
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
        this.io.sockets.in(this.id).emit("streams");
    }
    emitUsersMuted() {
        this.io.sockets
            .in(this.id)
            .emit("get-users-muted", [...this.usersMuted.values()]);
    }
    emitUsersCameraOnOff() {
        this.io.sockets
            .in(this.id)
            .emit("get-users-cameraOnOff", [...this.usersCameraOnOff.values()]);
    }
    emitUsersScreenShare() {
        this.io.sockets
            .in(this.id)
            .emit("get-users-shareScreen", [...this.usersScreenShare.values()]);
    }
    emitUserOperation(socket, userId, op, data) {
        socket.broadcast.to(this.id).emit("user-operation", userId, op, data);
    }
    emitChatMessage(socket, message) {
        socket.broadcast.to(this.id).emit("chat-message", message);
    }
    handleUserOperation(socket, userId, isTrue, op) {
        switch (op) {
            case "userCameraOnOff":
                isTrue
                    ? this.usersCameraOnOff.delete(userId)
                    : this.usersCameraOnOff.set(userId, userId);
                this.emitUserOperation(socket, userId, op, [
                    ...this.usersCameraOnOff.values(),
                ]);
                break;
            case "userMuted":
                isTrue
                    ? this.usersMuted.set(userId, userId)
                    : this.usersMuted.delete(userId);
                this.emitUserOperation(socket, userId, op, [
                    ...this.usersMuted.values(),
                ]);
                break;
            case "userScreenShare":
                isTrue
                    ? this.usersScreenShare.set(userId, userId)
                    : this.usersScreenShare.delete(userId);
                this.emitUserOperation(socket, userId, op, [
                    ...this.usersScreenShare.values(),
                ]);
                break;
            default:
                break;
        }
    }
}
