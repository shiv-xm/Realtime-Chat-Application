import { X, Search } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useState, useRef, useEffect } from "react";
import UserProfileModal from "./UserProfileModal";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { setSearchMode, setSearchQuery, searchQuery } = useChatStore();

  const [showProfile, setShowProfile] = useState(false);
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showMsgSearch) {
      setSearchMode("messages");
      // focus input when it appears
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // clear message search when closed
      setSearchQuery("");
      setSearchMode("people");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMsgSearch]);

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          {/* User info - name is clickable to open profile modal */}
          <div>
            <button onClick={() => setShowProfile(true)} className="font-medium hover:underline">
              {selectedUser.fullName}
            </button>
            <p className="text-sm text-base-content/70">{onlineUsers.includes(String(selectedUser._id)) ? "Online" : "Offline"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* message search toggle */}
          {showMsgSearch ? (
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search this chat"
              className="input input-sm"
            />
          ) : (
            <button onClick={() => setShowMsgSearch(true)} aria-label="Search messages">
              <Search />
            </button>
          )}

          {/* Close button */}
          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>

      {/* Profile modal */}
      {showProfile && <UserProfileModal user={selectedUser} onClose={() => setShowProfile(false)} />}
    </div>
  );
};
export default ChatHeader;
