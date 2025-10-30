import { Server } from "socket.io";

export function createSocketServer(server) {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173"], // frontend URL
      credentials: true,
    },
  });

  // Map to store online users -> support multiple socket connections per user
  // userSocketMap: { userId: Set(socketId) }
  const userSocketMap = {};

  // Helper to get a user's socket IDs (array)
  function getReceiverSocketId(userId) {
    const s = userSocketMap[userId];
    if (!s) return [];
    // return array of socketIds
    return Array.from(s);
  }

  // Socket connection
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Support multiple socket client handshake shapes: prefer auth then query
    const userId = socket.handshake?.auth?.userId || socket.handshake?.query?.userId;
    if (userId) {
      // log to aid debugging when clients connect without a userId
      console.log("A user connected with userId:", userId, socket.id);
      if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
      userSocketMap[userId].add(socket.id);
    } else {
      // still log anonymous connections for debugging
      console.log("A user connected (no userId supplied):", socket.id);
    }

  // Broadcast online users (list of userIds)
  const onlineUserIds = Object.keys(userSocketMap);
  console.log("Emitting getOnlineUsers ->", onlineUserIds);
  io.emit("getOnlineUsers", onlineUserIds);

    socket.on("disconnect", () => {
      console.log("A user disconnected:", socket.id);
      if (userId && userSocketMap[userId]) {
        userSocketMap[userId].delete(socket.id);
        if (userSocketMap[userId].size === 0) delete userSocketMap[userId];
      }
  const onlineAfterDisconnect = Object.keys(userSocketMap);
  console.log("Emitting getOnlineUsers after disconnect ->", onlineAfterDisconnect);
  io.emit("getOnlineUsers", onlineAfterDisconnect);
    });
  });

  return { io, getReceiverSocketId };
}
