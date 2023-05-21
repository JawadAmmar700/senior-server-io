import { type Socket, type Server } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

interface RoomsConstructorOptions {
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
}

type IO = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;

type User = {
  userId: string;
  username: string;
  email: string;
  photoUrl: string;
  room_name?: string;
  isCamera: boolean;
  isMic: boolean;
  isScreenShare: boolean;
  joinedAt: string;
};

type Participant = {
  userId: string;
  username: string;
  photoUrl: string;
  email: string;
  joinedAt: string;
  leftAt: string | null;
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
  roomParticipants = new Map<string, Participant>();
  isRoomCreator: string = null;

  constructor(
    room_name: string,
    id: string,
    roomsArgs: RoomsConstructorOptions
  ) {
    super(roomsArgs);
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

  addParticipant(user: User) {
    this.roomParticipants.set(user.userId, {
      ...user,
      joinedAt: this.dateToString(),
      leftAt: null,
    });
  }

  updateParticipant(userId: string) {
    const participant = this.roomParticipants.get(userId);
    if (participant) {
      participant.leftAt = this.dateToString();
      this.roomParticipants.set(userId, participant);
    }
  }

  addUser(socket: Socket, user: User, isRoomCreator: boolean) {
    this.users.set(socket.id, user);
    if (isRoomCreator) {
      this.isRoomCreator = socket.id;
    }
    this.addParticipant(user);
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
      .to(this.isRoomCreator)
      .emit("participants", [...this.roomParticipants.values()]);
  }

  emitUserOperation(socket: Socket, userId: string, op: string) {
    socket.broadcast.to(this.id).emit("user-operation", op, userId);
  }

  emitChatMessage(socket: Socket, message: any) {
    socket.broadcast.to(this.id).emit("chat-message", message);
  }
}

export { Rooms };
