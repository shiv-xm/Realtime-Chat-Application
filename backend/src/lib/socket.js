import { Server } from "socket.io";

export function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173"], // frontend URL
      credentials: true,
    },
  });

  // Map to store online users
  const userSocketMap = {}; // { userId: socketId }

  // Helper to get a user's socket ID
  function getReceiverSocketId(userId) {
    return userSocketMap[userId];
  }

  // Socket connection
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // Broadcast online users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });

  return { io, getReceiverSocketId };
}
