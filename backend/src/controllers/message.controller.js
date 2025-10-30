import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { translateText } from "../lib/translator.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    // fetch basic user list (exclude self)
    const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    // for each user gather last message and unseen count / last unseen text
    const enriched = await Promise.all(
      users.map(async (u) => {
        // last message between loggedInUserId and u._id
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: u._id },
            { senderId: u._id, receiverId: loggedInUserId },
          ],
        })
          .sort({ createdAt: -1 })
          .lean();

        // count unseen messages where the logged-in user is the receiver
        const unseenCount = await Message.countDocuments({ senderId: u._id, receiverId: loggedInUserId, isRead: { $ne: true } });

        // fetch last unseen message text when unseenCount > 0
        let lastUnseenText = null;
        if (unseenCount > 0) {
          const lastUnseen = await Message.findOne({ senderId: u._id, receiverId: loggedInUserId, isRead: { $ne: true } }).sort({ createdAt: -1 }).lean();
          lastUnseenText = lastUnseen ? (lastUnseen.originalText || lastUnseen.text || "") : null;
        }

        return {
          ...u.toObject(),
          lastMessage: lastMsg ? (lastMsg.originalText || lastMsg.text || lastMsg.translatedText || "") : null,
          lastMessageAt: lastMsg ? lastMsg.createdAt : null,
          unseenCount,
          lastUnseenText,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 }).lean();

    // If current user has a preferred language, attempt to translate incoming messages
    const myProfile = await User.findById(myId).select("preferredLanguage").lean();
    const preferred = myProfile?.preferredLanguage ? myProfile.preferredLanguage.trim() : "";

    if (preferred) {
      // Translate only messages that were sent by the other user (incoming to current user)
      for (const m of messages) {
        try {
          // only translate if this message was sent by the chat partner
          if (String(m.senderId) === String(userToChatId)) {
            // if already translated to the same language, reuse it
            if (m.targetLanguage && m.targetLanguage === preferred && m.translatedText) continue;

            const sourceText = m.originalText || m.text || "";
            if (!sourceText) continue;

            const { translatedText } = await translateText(sourceText, preferred);
            if (translatedText) {
              m.translatedText = translatedText;
              m.targetLanguage = preferred;
            }
          }
        } catch (err) {
          console.error("translation on fetch failed for message", m._id, err && err.message ? err.message : err);
          // continue without translation
        }
      }
    }

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
  const { text, image, audio } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

  // Temporary debug logs to help trace translation issues
  console.log('[sendMessage] incoming text length:', text ? text.length : 0);

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    let audioUrl;
    if (audio) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(audio, { resource_type: 'raw' });
        audioUrl = uploadResponse.secure_url;
      } catch (e) {
        console.error('Audio upload failed:', e && e.message ? e.message : e);
      }
    }

    // Check blocking: prevent messages if either party has blocked the other
    try {
      const sender = await User.findById(senderId).select("blockedUsers");
      const receiver = await User.findById(receiverId).select("blockedUsers");
      const senderBlocked = (sender?.blockedUsers || []).some((b) => String(b) === String(receiverId));
      const receiverBlocked = (receiver?.blockedUsers || []).some((b) => String(b) === String(senderId));
      if (senderBlocked || receiverBlocked) {
        return res.status(403).json({ error: "Cannot send message because one of the users has blocked the other" });
      }
    } catch (err) {
      console.error("Error checking blockedUsers:", err && err.message ? err.message : err);
    }

    // Prepare message payload. Keep original text and optionally translated text
    const messagePayload = {
      senderId,
      receiverId,
      originalText: text,
      text, // keep backward compatibility for any existing clients
      image: imageUrl,
      audio: audioUrl,
    };

    try {
  const receiverUser = await User.findById(receiverId).select("preferredLanguage");
  const receiverPref = receiverUser?.preferredLanguage ? receiverUser.preferredLanguage.trim() : "";

  // Only use the receiver's profile-based preferred language. Do not rely on a per-chat selection.
  const translationTarget = receiverPref;

  if (text && translationTarget) {
        console.log('[sendMessage] translating text for receiver target:', translationTarget);
        try {
          const { translatedText, sourceLanguage, targetLanguage } = await translateText(text, translationTarget);
          console.log('[sendMessage] translateText result:', {
            translatedText: translatedText ? (translatedText.length > 200 ? translatedText.slice(0, 200) + '...' : translatedText) : translatedText,
            sourceLanguage,
            targetLanguage,
          });
          messagePayload.translatedText = translatedText;
          messagePayload.sourceLanguage = sourceLanguage;
          messagePayload.targetLanguage = targetLanguage;
        } catch (err) {
          console.error("Translation failed:", err && err.message ? err.message : err);
          // proceed without translation
        }
      }
    } catch (err) {
      // If fetching receiver preferences fails, continue without translation
      console.error('Error fetching receiver preferences:', err && err.message ? err.message : err);
    }

    const newMessage = new Message(messagePayload);

    await newMessage.save();

    // Get io and helper from app
    const io = req.app.get("io");
    const getReceiverSocketId = req.app.get("getReceiverSocketId");

    const receiverSocketIds = getReceiverSocketId(receiverId);
    if (receiverSocketIds && receiverSocketIds.length > 0) {
      // deliver the saved message to all connected sockets for that user
      for (const sid of receiverSocketIds) io.to(sid).emit("newMessage", newMessage);
    }

    // Also notify sender's other clients about the new message
    const senderSocketIds = getReceiverSocketId(senderId);
    if (senderSocketIds && senderSocketIds.length > 0) {
      for (const sid of senderSocketIds) io.to(sid).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Dev/test helper: translate arbitrary text using the configured translator.
// This route can help debug API key/response issues. Keep protected in production.
export const translateTest = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    console.log("text:",text);
    if (!text) return res.status(400).json({ error: "text is required" });

    console.log("translateTest called with targetLanguage:", targetLanguage);
    const result = await translateText(text, targetLanguage);
    console.log("translateTest result:", result && result.translatedText ? result.translatedText.slice(0, 200) : result);
    res.status(200).json(result);
  } catch (error) {
    console.error("translateTest error:", error.message || error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) return res.status(400).json({ error: "emoji is required" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Find existing reaction by this user
    const existingIndex = message.reactions.findIndex((r) => r.userId.toString() === userId.toString());

    if (existingIndex > -1) {
      // If same emoji, remove (toggle off). If different, update.
      if (message.reactions[existingIndex].emoji === emoji) {
        message.reactions.splice(existingIndex, 1);
      } else {
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    // Emit socket event to both participants if connected
    const io = req.app.get("io");
    const getReceiverSocketId = req.app.get("getReceiverSocketId");

    // notify recipient
    const otherUserId = message.senderId.toString() === userId.toString() ? message.receiverId : message.senderId;
    const otherSocketIds = getReceiverSocketId(otherUserId.toString());
    if (otherSocketIds && otherSocketIds.length > 0) {
      for (const sid of otherSocketIds) io.to(sid).emit("messageReactionUpdated", message);
    }

    // notify actor's other clients
    const actorSocketIds = getReceiverSocketId(userId.toString());
    if (actorSocketIds && actorSocketIds.length > 0) {
      for (const sid of actorSocketIds) io.to(sid).emit("messageReactionUpdated", message);
    }

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in reactToMessage:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesRead = async (req, res) => {
  try {
    const { id: otherUserId } = req.params; // the chat partner whose messages should be marked read for the current user
    const myId = req.user._id;

    // mark as read all messages where current user is the receiver and otherUserId is the sender
    const result = await Message.updateMany(
      { senderId: otherUserId, receiverId: myId, isRead: { $ne: true } },
      { $set: { isRead: true } }
    );

    res.status(200).json({ modifiedCount: result.modifiedCount || result.nModified || 0 });
  } catch (error) {
    console.error("Error in markMessagesRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const markAllMessagesRead = async (req, res) => {
  try {
    const myId = req.user._id;
    const result = await Message.updateMany(
      { receiverId: myId, isRead: { $ne: true } },
      { $set: { isRead: true } }
    );

    res.status(200).json({ modifiedCount: result.modifiedCount || result.nModified || 0 });
  } catch (error) {
    console.error("Error in markAllMessagesRead:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const searchAll = async (req, res) => {
  try {
    const q = req.query.q || "";
    const myId = req.user._id;
    if (!q) return res.status(200).json({ users: [], messages: [] });

    const regex = new RegExp(q, "i");

    // search users (exclude self)
    const users = await User.find({ _id: { $ne: myId }, $or: [{ fullName: regex }, { email: regex }] }).select("-password");

    // search messages where the logged-in user is a participant
    const messages = await Message.find({
      $and: [
        { $or: [{ senderId: myId }, { receiverId: myId }] },
        { $or: [{ originalText: regex }, { text: regex }, { translatedText: regex }] },
      ],
    }).sort({ createdAt: -1 }).limit(100);

    // normalize message preview for frontend
    const normalized = messages.map((m) => ({
      _id: m._id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      preview: (m.originalText || m.translatedText || m.text || "").slice(0, 120),
      createdAt: m.createdAt,
      // help frontend determine the other participant
      _currentUserId: myId,
    }));

    res.status(200).json({ users, messages: normalized });
  } catch (error) {
    console.error("Error in searchAll:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const searchInChat = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const q = req.query.q || "";
    const myId = req.user._id;
    if (!q) return res.status(200).json([]);

    const regex = new RegExp(q, "i");

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      $or: [{ originalText: regex }, { text: regex }, { translatedText: regex }],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in searchInChat:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

