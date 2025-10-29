import { useState } from "react";
import { smartReplies as aiSmartReplies } from "../lib/ai";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const SmartReplies = ({ message, context = [] }) => {
  const [loading, setLoading] = useState(false);
  const [replies, setReplies] = useState([]);
  const { setDraft, sendMessage } = useChatStore();

  const fetchReplies = async () => {
    setLoading(true);
    try {
      const res = await aiSmartReplies({ message, context });
      const items = res?.replies || res || [];
      setReplies(items.slice(0, 5));
    } catch (err) {
      console.error("SmartReplies error", err);
      toast.error("Failed to get smart replies");
    } finally {
      setLoading(false);
    }
  };

  const insertReply = (r) => {
    setDraft(r);
    toast.success("Inserted suggestion into input");
  };

  const sendReply = async (r) => {
    try {
      await sendMessage({ text: r });
      toast.success("Sent reply");
    } catch (err) {
      console.error("sendReply error", err);
      toast.error("Failed to send reply");
    }
  };

  return (
    <div className="mt-2">
      <button
        className="btn btn-ghost btn-xs"
        onClick={fetchReplies}
        disabled={loading}
      >
        {loading ? "Loading…" : "AI Replies"}
      </button>

      {replies && replies.length > 0 && (
        <div className="mt-2 space-y-1">
          {replies.map((r, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button className="btn btn-sm btn-outline flex-1 text-left" onClick={() => insertReply(r)}>
                {r}
              </button>
              <button className="btn btn-sm" onClick={() => sendReply(r)}>
                Send
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartReplies;
