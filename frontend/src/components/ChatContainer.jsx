import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import SmartReplies from "./SmartReplies";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { searchQuery, searchMode } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const firstUnreadRef = useRef(null);
  const { aiRepliesEnabled } = useSettingsStore();

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Find first unread incoming message (sent by selectedUser and not read)
    const firstUnread = messages.find((m) => m.senderId === selectedUser._id && !m.isRead);
    if (firstUnread) {
      // scroll to first unread message if present
      // We attach ref to that message element during render
        if (firstUnreadRef.current) {
          // attempt to scroll; ignore any exceptions
          try { firstUnreadRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); return; } catch { /* ignore */ }
        }
    }

    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedUser._id]);

  // prepare message search results (search within currently loaded messages)
  const messageMatches =
    searchMode === "messages" && searchQuery
      ? messages.filter((m) => m.text && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      : null;

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Render either searched messages (from current chat) or the full message list */}
        {(() => {
          const renderMessages = messageMatches || messages;
          if (!renderMessages || renderMessages.length === 0) {
            return <div className="text-center text-zinc-500 py-4">No matching messages</div>;
          }

          // determine first unread incoming message id
          const firstUnread = (renderMessages || []).find((m) => m.senderId === selectedUser._id && !m.isRead);
          const firstUnreadId = firstUnread?._id;

          return renderMessages.map((message) => (
            <div
              key={message._id}
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              ref={message._id === firstUnreadId ? firstUnreadRef : messageEndRef}
            >
              <div className=" chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      message.senderId === authUser._id
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                  />
                </div>
              </div>
              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
              </div>
              <div className="chat-bubble flex flex-col">
                {message.image && (
                  <img src={message.image} alt="Attachment" className="sm:max-w-[200px] rounded-md mb-2" />
                )}
                {(() => {
                  // Show translatedText for incoming messages when available, otherwise fallback to stored text
                  const incoming = message.senderId !== authUser._id;
                  const display = incoming ? (message.translatedText || message.text) : (message.text || message.translatedText || "");
                  return display ? <p>{display}</p> : null;
                })()}
              </div>

              {/* Smart replies placed under incoming messages when enabled in Settings */}
              {message.senderId !== authUser._id && aiRepliesEnabled && (
                <div className="ml-2 mt-1">
                  <SmartReplies message={message.text} context={messages.slice(-20)} />
                </div>
              )}

              {/* reactions removed per user request */}
            </div>
          ));
        })()}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
