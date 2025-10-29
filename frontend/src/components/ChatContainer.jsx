import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import SmartReplies from "./SmartReplies";
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

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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

          return renderMessages.map((message) => (
            <div
              key={message._id}
            
              className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
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
                {message.text && <p>{message.text}</p>}
              </div>

              {/* Smart replies placed under incoming messages */}
              {message.senderId !== authUser._id && (
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
