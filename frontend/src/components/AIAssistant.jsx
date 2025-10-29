import { useEffect, useState } from "react";
import { assistant as aiAssistant } from "../lib/ai";
import { useChatStore } from "../store/useChatStore";

const AIAssistant = ({ open, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { messages } = useChatStore();

  useEffect(() => {
    if (!open) return;

    const run = async () => {
      setLoading(true);
      try {
        // send recent messages as context; transform to simple role/content pairs
        const context = (messages || []).slice(-30).map((m) => ({ role: m.senderId ? "user" : "system", content: `${m.senderName || m.senderId}: ${m.text || ""}` }));
        const res = await aiAssistant({ instruction: "Summarize the recent conversation and provide 3 suggested replies.", context });
        setResult(res.content || res.raw || res);
      } catch (err) {
        console.error("AIAssistant error", err);
        setResult("Failed to fetch assistant output");
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-base-100 rounded-lg p-4 w-[90%] max-w-2xl">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">AI Assistant</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm">{typeof result === "string" ? result : JSON.stringify(result, null, 2)}</pre>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
