import { useState, useEffect } from "react";
import { smartReplies as aiSmartReplies } from "../lib/ai";
import { useChatStore } from "../store/useChatStore";
import { useSettingsStore } from "../store/useSettingsStore";
import toast from "react-hot-toast";

const SmartReplies = ({ message, context = [] }) => {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // single generated reply for this message
  const { aiRepliesEnabled, aiTone } = useSettingsStore();
  const { setDraft, sendMessage } = useChatStore();
  const [showTonePicker, setShowTonePicker] = useState(false);
  const [selectedTone, setSelectedTone] = useState(null);

  // Auto-fetch replies when global AI replies are enabled and a new message mounts
  useEffect(() => {
    if (aiRepliesEnabled) {
      fetchReplyForMessage(aiTone || "neutral");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiRepliesEnabled, message]);

  // Generate a single smart reply for this message with the requested tone
  const fetchReplyForMessage = async (toneParam = null) => {
    setLoading(true);
    try {
      const toneToUse = toneParam || aiTone || "neutral";
      const res = await aiSmartReplies({ message, context, tone: toneToUse });
      // backend returns { replies } or an array of strings
      const items = res?.replies || res || [];
      const first = Array.isArray(items) ? items[0] : items;
      setSuggestion(first || null);
    } catch (err) {
      console.error("SmartReplies error", err);
      toast.error("Failed to get smart reply (network or AI error)");
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
      setSuggestion(null);
      toast.success("Sent reply");
    } catch (err) {
      console.error("sendReply error", err);
      toast.error("Failed to send reply");
    }
  };

  return (
    <div className="mt-2">
      {/* When AI Replies are enabled globally, show a subtle Smart Reply link below the message */}
      <div className="relative inline-block">
        <button
          className="btn btn-ghost btn-xs"
          onClick={() => {
            // open tone picker; user can pick a tone or leave it — we'll use default if none chosen
            setShowTonePicker((s) => !s);
            setSelectedTone(null);
          }}
          disabled={!aiRepliesEnabled || loading}
        >
          {loading ? "Loading…" : "Smart Reply"}
        </button>

        {showTonePicker && (
          <div className="absolute z-20 mt-1 right-0 bg-base-100 p-2 rounded shadow-md w-44">
            <div className="text-xs text-base-content/70 mb-2">Select tone (or use default)</div>
            <div className="space-y-1">
              {[
                { key: "neutral", label: "Neutral" },
                { key: "professional", label: "Professional" },
                { key: "friendly", label: "Friendly" },
                { key: "polite", label: "Polite" },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`btn btn-ghost btn-xs w-full text-left ${selectedTone === t.key ? "bg-base-200" : ""}`}
                  onClick={() => {
                    setSelectedTone(t.key);
                    setShowTonePicker(false);
                    fetchReplyForMessage(t.key);
                  }}
                >
                  {t.label}
                </button>
              ))}

              <div className="pt-2 border-t">
                <button
                  className="btn btn-ghost btn-xs w-full text-left"
                  onClick={() => {
                    // use default tone from settings
                    setShowTonePicker(false);
                    fetchReplyForMessage(null);
                  }}
                >
                  Use default tone
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Show single suggestion once generated */}
      {suggestion && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 p-2 rounded-md bg-base-200 text-sm">{suggestion}</div>
            <button className="btn btn-sm" onClick={() => insertReply(suggestion)}>Edit</button>
            <button className="btn btn-sm btn-primary" onClick={() => sendReply(suggestion)}>Send</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSuggestion(null)}>Ignore</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartReplies;
