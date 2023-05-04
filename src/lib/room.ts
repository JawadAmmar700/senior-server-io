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
  // isCamera: boolean;
  // isMic: boolean;
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
  }

  removeUser(socket: Socket) {
    const user = this.users.get(socket.id);
    if (user) {
      const disconnectedUserID = user.userId;
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
  }

  emitUserOperation(socket: Socket, userId: string, op: string) {
    socket.broadcast.to(this.id).emit("user-operation", op, userId);
  }

  emitChatMessage(socket: Socket, message: any) {
    socket.broadcast.to(this.id).emit("chat-message", message);
  }
}

export { Rooms };
