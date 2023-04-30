import { type Socket, type Server } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

interface RoomsConstructorOptions {
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
}

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;

type User = {
  userId: string;
  username: string;
  photoUrl: string;
};

class Rooms {
  rooms = new Map();
  io: IO;

  constructor(options: RoomsConstructorOptions) {
    this.io = options.io;
    this.rooms = new Map();
  }

  createRoom(name: string, id: string) {
    if (!this.rooms.has(id)) {
      this.rooms.set(id, new Room(name, id, { io: this.io }));
    }

    return this.rooms.get(id);
  }

  removeRoom(id: string) {
    if (this.rooms.has(id)) {
      this.rooms.delete(id);
    }
  }
}

class Room extends Rooms {
  name: string;
  id: string;
  users = new Map<string, User>();
  usersCameraOnOff = new Map<string, string>();
  usersMuted = new Map<string, string>();
  usersScreenShare = new Map<string, string>();

  constructor(
    room_name: string,
    id: string,
    roomsArgs: RoomsConstructorOptions
  ) {
    super(roomsArgs);
    this.name = room_name;
    this.id = id;
  }

  addUser(socket: Socket, user: User) {
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

  removeUser(socket: Socket) {
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

  emitUserOperation(
    socket: Socket,
    userId: string,
    op: string,
    data: Array<string>
  ) {
    socket.broadcast.to(this.id).emit("user-operation", userId, op, data);
  }

  emitChatMessage(socket: Socket, message: string) {
    socket.broadcast.to(this.id).emit("chat-message", message);
  }

  handleUserOperation(
    socket: Socket,
    userId: string,
    isTrue: boolean,
    op: string
  ) {
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

export { Rooms };
