import express from "express";
import http from "http";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";
import { createSocketServer } from "./lib/socket.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";

dotenv.config();

const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// Create Express app
const app = express();
const server = http.createServer(app);

// Attach Socket.io
const io = createSocketServer(server);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173", // your frontend URL
    credentials: true,
  })
);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "../frontend/dist");

  app.use(express.static(frontendPath));

  // React Router fallback for non-API routes
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next(); // skip API routes
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Start server and connect DB
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
  connectDB();
});
