import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";

const UserProfileModal = ({ user, onClose }) => {
  const { authUser, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");

  useEffect(() => {
    setBio(user?.bio || "");
  }, [user]);

  if (!user) return null;

  const isCurrentUser = authUser && authUser._id === user._id;

  const save = async () => {
    try {
      await updateProfile({ bio });
      setEditing(false);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-base-100 rounded-md shadow-lg w-11/12 max-w-md p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-medium">Profile</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="avatar">
            <div className="size-24 rounded-full border">
              <img src={user.profilePic || "/avatar.png"} alt={user.fullName} />
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-xl font-semibold">{user.fullName}</h3>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>

          <div className="w-full mt-4">
            <h4 className="text-sm font-medium mb-2">About</h4>

            {editing ? (
              <div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="textarea textarea-bordered w-full"
                  rows={4}
                />
                <div className="flex gap-2 mt-2 justify-end">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={save}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-zinc-500">{user.bio || "No bio available"}</p>
                {isCurrentUser && (
                  <div className="mt-2 text-right">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 text-sm text-zinc-500">
              <div>Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
