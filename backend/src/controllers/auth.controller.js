import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import Report from "../models/report.model.js";

export const signup = async (req, res) => {
  const { fullName, email, password, preferredLanguage } = req.body;
  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      preferredLanguage: preferredLanguage || "",
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        preferredLanguage: newUser.preferredLanguage || "",
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.log("Error in signup controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      preferredLanguage: user.preferredLanguage || "",
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic, bio, fullName, preferredLanguage } = req.body;
    const userId = req.user._id;

    const updates = {};
    if (fullName) updates.fullName = fullName;
    if (typeof bio !== "undefined") updates.bio = bio;
    if (typeof preferredLanguage !== "undefined") updates.preferredLanguage = preferredLanguage;
    // Support AI preferences in profile updates
    if (typeof req.body.smartSuggestionsEnabled !== "undefined") {
      updates.smartSuggestionsEnabled = req.body.smartSuggestionsEnabled;
    }
    if (typeof req.body.aiTonePreference !== "undefined") {
      updates.aiTonePreference = req.body.aiTonePreference;
    }

    if (profilePic) {
      // upload image (profilePic can be a data URL or remote URL)
      const uploadResponse = await cloudinary.uploader.upload(profilePic);
      updates.profilePic = uploadResponse.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true }).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.user._id;
    if (String(targetId) === String(userId)) return res.status(400).json({ error: "Cannot block yourself" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.find((b) => String(b) === String(targetId))) {
      user.blockedUsers.push(targetId);
      await user.save();
    }

    const out = await User.findById(userId).select("-password");
    return res.status(200).json(out);
  } catch (err) {
    console.error("blockUser error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.blockedUsers = (user.blockedUsers || []).filter((b) => String(b) !== String(targetId));
    await user.save();

    const out = await User.findById(userId).select("-password");
    return res.status(200).json(out);
  } catch (err) {
    console.error("unblockUser error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const reportUser = async (req, res) => {
  try {
    const reportedId = req.params.id;
    const reporterId = req.user._id;
    const { reason, details } = req.body;
    if (!reason) return res.status(400).json({ error: "reason is required" });

    const rep = new Report({ reporterId, reportedId, reason, details: details || "" });
    await rep.save();

    return res.status(201).json({ message: "Report submitted" });
  } catch (err) {
    console.error("reportUser error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};