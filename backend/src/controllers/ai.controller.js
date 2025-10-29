import { proofreadAndAdjustTone, assistantConversation, generateSmartReplies, rewriteMessage } from "../lib/gemini.js";

export const proofread = async (req, res) => {
  try {
    const { text, tone } = req.body;
    if (!text) return res.status(400).json({ message: "text is required" });

    const result = await proofreadAndAdjustTone(text, tone || "neutral");
    return res.json(result);
  } catch (error) {
    console.error("AI Proofread error:", error);
    return res.status(500).json({ message: error.message || "AI error" });
  }
};

export const assistant = async (req, res) => {
  try {
    const { instruction, context } = req.body;
    const result = await assistantConversation(context || [], instruction || "Provide a helpful response");
    return res.json(result);
  } catch (error) {
    console.error("AI Assistant error:", error);
    return res.status(500).json({ message: error.message || "AI error" });
  }
};

export const smartReplies = async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ message: "message is required" });

    const replies = await generateSmartReplies(message, context || []);
    return res.json({ replies });
  } catch (error) {
    console.error("AI SmartReplies error:", error);
    return res.status(500).json({ message: error.message || "AI error" });
  }
};

export const rewrite = async (req, res) => {
  try {
    const { text, style } = req.body;
    if (!text) return res.status(400).json({ message: "text is required" });

    const result = await rewriteMessage(text, style || "neutral");
    return res.json(result);
  } catch (error) {
    console.error("AI Rewrite error:", error);
    return res.status(500).json({ message: error.message || "AI error" });
  }
};

