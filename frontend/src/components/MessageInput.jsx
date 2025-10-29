import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { Image, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { proofread as aiProofread } from "../lib/ai";

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
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiTone, setAiTone] = useState("neutral");

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
      let textToSend = text.trim();

      // If AI proofreading is enabled, call backend to proofread/adjust tone
      if (aiEnabled && textToSend) {
        try {
          const result = await aiProofread({ text: textToSend, tone: aiTone });
          if (result && result.rewritten) {
            textToSend = result.rewritten;
            if (result.summary) toast.success(`AI: ${result.summary}`);
          }
        } catch (aiErr) {
          console.error("AI proofread failed", aiErr);
          toast.error("AI proofreading failed, sending original message.");
        }
      }

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
          {/* AI Proofreader toggle + tone selector */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="hidden sm:inline">AI</span>
            </label>

            <select
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value)}
              className="select select-sm"
              disabled={!aiEnabled}
            >
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
              <option value="polite">Polite</option>
              <option value="friendly">Friendly</option>
            </select>
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
    </div>
  );
};
export default MessageInput;
