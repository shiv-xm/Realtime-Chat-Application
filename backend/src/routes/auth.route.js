import express from "express";
import { checkAuth, login, logout, signup, updateProfile, blockUser, unblockUser, getBlockedUsers } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup)

router.post("/login", login);

router.post("/logout", logout);

router.put("/update-profile",protectRoute , updateProfile);

router.get("/check",protectRoute,checkAuth);

// block/unblock and blocked list
router.post("/block/:id", protectRoute, blockUser);
router.post("/unblock/:id", protectRoute, unblockUser);
router.get("/blocked", protectRoute, getBlockedUsers);

export default router; 