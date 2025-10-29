import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { proofread, assistant, smartReplies, rewrite } from "../controllers/ai.controller.js";

const router = express.Router();

// All AI endpoints are protected — they operate on behalf of an authenticated user.
router.post("/proofread", protectRoute, proofread);
router.post("/assistant", protectRoute, assistant);
router.post("/smart-replies", protectRoute, smartReplies);
router.post("/rewrite", protectRoute, rewrite);

export default router;
