import { Server } from "socket.io";

let io; // Socket.io instance
const userSocketMap = {}; // { userId: socketId }

// Create Socket.io server on top of existing HTTP server
export function createSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173"], // frontend origin
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // Broadcast online users
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      console.log("A user disconnected", socket.id);
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
  });

  return io;
}

// Helper to get a specific user's socket ID
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}
