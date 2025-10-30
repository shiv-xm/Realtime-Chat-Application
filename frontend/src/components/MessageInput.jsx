import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { proofread as aiProofread } from "../lib/ai";
import { useSettingsStore } from "../store/useSettingsStore";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);
  const { sendMessage, draftText, setDraft } = useChatStore();
  // keep component input synced with store draftText (e.g., from AI suggestions)
  useEffect(() => {
    if (typeof draftText === "string" && draftText !== text) {
      setText(draftText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftText]);
  // AI settings live in global settings (moved to Settings page)
  const { aiSuggestionsEnabled, aiTone } = useSettingsStore();

  const [proofreadModalOpen, setProofreadModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]); // { index, original, suggestion }
  const [isProofreading, setIsProofreading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    try {
      const textToSend = text.trim();

      await sendMessage({
        text: textToSend,
        image: imagePreview,
      });

    // Clear draft stored in global store (if any)
      setDraft("");

      // Clear form
      setText("");
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const splitSentences = (s) => {
    if (!s) return [];
    const parts = s.match(/[^.!?]+[.!?]*/g);
    return parts && parts.length ? parts.map((p) => p.trim()) : [s.trim()];
  };

  const handleProofread = async () => {
    if (!text.trim()) return toast.error("Type a message to proofread");
    if (!aiSuggestionsEnabled) return toast.error("AI suggestions are disabled. Enable them in Settings to use the Proofreader.");

    setIsProofreading(true);
    try {
  const toneToUse = aiTone || "neutral";
      const res = await aiProofread({ text: text.trim(), tone: toneToUse });
      const corrected = (res && (res.correctedText || res.rewritten)) || text;
      const origSent = splitSentences(text);
      const corrSent = splitSentences(corrected);

      const items = [];
      const max = Math.max(origSent.length, corrSent.length);
      for (let i = 0; i < max; i++) {
        const o = origSent[i] ?? "";
        const c = corrSent[i] ?? "";
        if (o.trim() !== c.trim()) {
          items.push({ index: i, original: o, suggestion: c });
        }
      }

      setSuggestions(items);
      setProofreadModalOpen(true);
      if (items.length === 0) {
        toast.success("No suggestions — looks good!");
      }
    } catch (err) {
      console.error("Proofread failed:", err);
      toast.error("Proofreading failed. Try again later.");
    } finally {
      setIsProofreading(false);
    }
  };

  const applySuggestion = (item) => {
    // Replace the sentence at item.index with suggestion
    const origSent = splitSentences(text);
    const newSent = [...origSent];
    if (item.index < newSent.length) {
      newSent[item.index] = item.suggestion;
    } else {
      // append if indexing mismatched
      newSent.push(item.suggestion);
    }
    const updated = newSent.filter(Boolean).join(" ").trim();
    setText(updated);
    // remove accepted suggestion from list
    setSuggestions((s) => s.filter((x) => !(x.index === item.index && x.suggestion === item.suggestion)));
  };

  const ignoreSuggestion = (item) => {
    setSuggestions((s) => s.filter((x) => !(x.index === item.index && x.suggestion === item.suggestion)));
  };

  return (
    <div className="p-4 w-full">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {/* Proofreader button (runs on demand) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`btn btn-ghost btn-sm ${isProofreading ? "loading" : ""}`}
              onClick={handleProofread}
              title="Run Proofreader"
            >
              Proofreader
            </button>
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Image size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !imagePreview}
        >
          <Send size={22} />
        </button>
      </form>

      {proofreadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-base-100 w-full max-w-lg rounded-md p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Proofreader Suggestions</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setProofreadModalOpen(false); setSuggestions([]); }}>Close</button>
            </div>

            <div className="mt-3 max-h-64 overflow-y-auto">
              {suggestions.length === 0 ? (
                <div className="py-6 text-center text-sm text-base-content/70">No suggestions available.</div>
              ) : (
                suggestions.map((s) => (
                  <div key={`${s.index}-${s.suggestion}`} className="border-b py-2">
                    <div className="text-xs text-base-content/70">Original</div>
                    <div className="mb-1">{s.original}</div>
                    <div className="text-xs text-base-content/70">Suggestion</div>
                    <div className="mb-2 font-medium">{s.suggestion}</div>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-primary" onClick={() => applySuggestion(s)}>Accept</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => ignoreSuggestion(s)}>Ignore</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => { setProofreadModalOpen(false); setSuggestions([]); }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MessageInput;
