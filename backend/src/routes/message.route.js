import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage, reactToMessage, markMessagesRead, markAllMessagesRead } from "../controllers/message.controller.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, sendMessage);
router.post("/:id/reaction", protectRoute, reactToMessage);
// mark messages read for a specific chat partner
router.post("/:id/mark-read", protectRoute, markMessagesRead);
// mark all unread messages (where current user is receiver) as read
router.post("/mark-all-read", protectRoute, markAllMessagesRead);

export default router;