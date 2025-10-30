import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";

export const createGroup = async (req, res) => {
  try {
    const { groupName, groupIcon, description, members } = req.body;
    const adminId = req.user._id;
    if (!groupName) return res.status(400).json({ error: "groupName is required" });

    // Ensure members array includes admin
    const memberIds = Array.isArray(members) ? members.slice() : [];
    if (!memberIds.find((m) => String(m) === String(adminId))) memberIds.push(adminId);

    const group = new Group({ groupName, groupIcon: groupIcon || "", description: description || "", members: memberIds, adminId });
    await group.save();

    // Optionally: notify members via socket that they were added to a group (if sockets available)
    const io = req.app.get("io");
    if (io) {
      // notify each member (if connected) about new group
      for (const m of memberIds) {
        const getReceiverSocketId = req.app.get("getReceiverSocketId");
        const sids = getReceiverSocketId(String(m));
        if (sids && sids.length) {
          for (const sid of sids) io.to(sid).emit("groupCreated", group);
        }
      }
    }

    return res.status(201).json(group);
  } catch (err) {
    console.error("createGroup error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getGroupsForUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId }).lean();
    return res.status(200).json(groups);
  } catch (err) {
    console.error("getGroupsForUser error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { groupName, groupIcon, description } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Only admin can update group info
    if (String(group.adminId) !== String(userId)) return res.status(403).json({ error: "Forbidden" });

    if (typeof groupName !== "undefined") group.groupName = groupName;
    if (typeof groupIcon !== "undefined") group.groupIcon = groupIcon;
    if (typeof description !== "undefined") group.description = description;

    await group.save();

    // notify members about update
    const io = req.app.get("io");
    if (io) io.to(`group_${group._id}`).emit("groupUpdated", group);

    return res.status(200).json(group);
  } catch (err) {
    console.error("updateGroup error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addMember = async (req, res) => {
  try {
    const { id } = req.params; // group id
    const { memberId } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Only admin can add members
    if (String(group.adminId) !== String(userId)) return res.status(403).json({ error: "Forbidden" });

    if (!memberId) return res.status(400).json({ error: "memberId is required" });
    if (group.members.find((m) => String(m) === String(memberId))) return res.status(400).json({ error: "Member already in group" });

    group.members.push(memberId);
    await group.save();

    // notify the member
    const io = req.app.get("io");
    const getReceiverSocketId = req.app.get("getReceiverSocketId");
    if (io) {
      const sids = getReceiverSocketId(String(memberId));
      if (sids && sids.length) {
        for (const sid of sids) io.to(sid).emit("addedToGroup", group);
      }
    }

    // notify room
    if (io) io.to(`group_${group._id}`).emit("groupMemberAdded", { groupId: group._id, memberId });

    return res.status(200).json(group);
  } catch (err) {
    console.error("addMember error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { id } = req.params; // group id
    const { memberId } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Only admin can remove members
    if (String(group.adminId) !== String(userId)) return res.status(403).json({ error: "Forbidden" });

    if (!memberId) return res.status(400).json({ error: "memberId is required" });

    group.members = group.members.filter((m) => String(m) !== String(memberId));
    await group.save();

    // notify member
    const io = req.app.get("io");
    const getReceiverSocketId = req.app.get("getReceiverSocketId");
    if (io) {
      const sids = getReceiverSocketId(String(memberId));
      if (sids && sids.length) {
        for (const sid of sids) io.to(sid).emit("removedFromGroup", { groupId: group._id });
      }
    }

    if (io) io.to(`group_${group._id}`).emit("groupMemberRemoved", { groupId: group._id, memberId });

    return res.status(200).json(group);
  } catch (err) {
    console.error("removeMember error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { id } = req.params; // group id
    const { text, image } = req.body;
  const { audio } = req.body;
    const senderId = req.user._id;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // ensure sender is member
    if (!group.members.find((m) => String(m) === String(senderId))) return res.status(403).json({ error: "You are not a member of this group" });

    let audioUrl;
    if (audio) {
      try {
        const uploadResponse = await cloudinary.uploader.upload(audio, { resource_type: 'raw' });
        audioUrl = uploadResponse.secure_url;
      } catch (e) {
        console.error('Group audio upload failed:', e && e.message ? e.message : e);
      }
    }

    const messagePayload = {
      senderId,
      groupId: group._id,
      originalText: text,
      text,
      image,
      audio: audioUrl,
    };

    const newMessage = new Message(messagePayload);
    await newMessage.save();

    // broadcast to group members individually, skipping blocked users
    const io = req.app.get("io");
    const getReceiverSocketId = req.app.get("getReceiverSocketId");
    if (io) {
      // for each member, skip sender and any member that has blocked sender or is blocked by sender
      for (const m of group.members) {
        const mid = String(m);
        if (mid === String(senderId)) continue;
        try {
          const memberUser = await User.findById(mid).select("blockedUsers");
          const senderUser = await User.findById(senderId).select("blockedUsers");
          const memberHasBlockedSender = (memberUser?.blockedUsers || []).some((b) => String(b) === String(senderId));
          const senderHasBlockedMember = (senderUser?.blockedUsers || []).some((b) => String(b) === mid);
          if (memberHasBlockedSender || senderHasBlockedMember) continue;
        } catch (err) {
          // if error fetching user, skip delivering to that member
          console.error("Error checking blockedUsers for group delivery:", err && err.message ? err.message : err);
          continue;
        }
        const sids = getReceiverSocketId(mid);
        if (sids && sids.length) {
          for (const sid of sids) io.to(sid).emit("groupMessage", newMessage);
        }
      }
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("sendGroupMessage error:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
