import { GoogleGenAI } from "@google/genai";

const createAiClient = (apiKey) => {
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error("createAiClient error:", err && err.message ? err.message : err);
    return null;
  }
};

const parseResponse = (res) => {
  if (!res) return null;
  try {
    const candidate = res?.candidates?.[0] || res?.output?.[0] || null;
    if (!candidate) return null;
    if (candidate?.content?.parts) {
      return candidate.content.parts.map((p) => p.text || "").join("");
    }
    if (typeof candidate.output === "string") return candidate.output;
    if (typeof candidate.content === "string") return candidate.content;
    return JSON.stringify(candidate);
  } catch (err) {
    console.error("parseResponse error:", err && err.message ? err.message : err);
    return null;
  }
};

const getApiKey = () => (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

// Simple in-memory cache for suggestions to avoid duplicate calls
const cache = new Map(); // key -> { value, expiresAt }
const CACHE_TTL_MS = 30 * 1000; // 30s

// Circuit-breaker state for quota/exhaustion handling
let consecutive429 = 0;
let cooldownUntil = 0; // timestamp ms until which we avoid calling the API

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const parseRetryDelay = (s) => {
  if (!s) return 0;
  // Examples: "1s", "585.222257ms"
  try {
    if (typeof s !== "string") return 0;
    s = s.trim();
    if (s.endsWith("ms")) return parseFloat(s.replace("ms", "")) || 0;
    if (s.endsWith("s")) return (parseFloat(s.replace("s", "")) || 0) * 1000;
    // fallback: try parseFloat
    return parseFloat(s) * 1000 || 0;
  } catch (err) {
    return 0;
  }
};

export const proofreadAndTone = async (text, tone = "neutral") => {
  if (!text) return { correctedText: "", issues: [], toneApplied: tone };

  const apiKey = getApiKey();
  if (!apiKey) {
    const corrected = `${text}`;
    const issues = [];
    return { correctedText: corrected, issues, toneApplied: tone };
  }

  const aiClient = createAiClient(apiKey);
  if (!aiClient) return { correctedText: text, issues: [], toneApplied: tone };

  const prompt = `You are an assistant that checks and improves user messages.\n\nTask: 1) Proofread the following message for grammar, spelling, punctuation and clarity. 2) Return a list of detected issues (brief). 3) Rewrite the message applying the requested tone: ${tone}.\n\nMessage:\n"""\n${text}\n"""\n\nRespond with a JSON object with keys: correctedText (string), issues (array of short strings). Reply ONLY with the JSON.`;

  try {
    const res = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { text: prompt },
      temperature: 0.2,
      maxOutputTokens: 800,
    });

    const parsed = parseResponse(res);
    if (!parsed) return { correctedText: text, issues: [], toneApplied: tone };

    const jsonStart = parsed.indexOf("{");
    const jsonText = jsonStart > -1 ? parsed.slice(jsonStart) : parsed;
    try {
      const obj = JSON.parse(jsonText);
      return { correctedText: obj.correctedText || text, issues: obj.issues || [], toneApplied: tone };
    } catch (err) {
      return { correctedText: parsed.trim(), issues: [], toneApplied: tone };
    }
  } catch (err) {
    console.error("proofreadAndTone error:", err && err.message ? err.message : err);
    return { correctedText: text, issues: [], toneApplied: tone };
  }
};

export const assistantAction = async (conversation = [], action = "summarize", options = {}) => {
  if (!Array.isArray(conversation)) conversation = [];

  const apiKey = getApiKey();
  if (!apiKey) {
    if (action === "summarize") return { summary: conversation.slice(-5).map((m) => m.content).join(" \n ") };
    if (action === "explain") return { explanation: `Explanation (mock): ${conversation.slice(-1)[0]?.content || ""}` };
    if (action === "composeReply") return { reply: "(mock reply) Thanks for the message!" };
    return { result: null };
  }

  const aiClient = createAiClient(apiKey);
  if (!aiClient) return { result: null };

  let prompt = "";
  if (action === "summarize") {
    prompt = `Summarize the following conversation in 2-4 concise bullet points:\n\n${conversation.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
  } else if (action === "explain") {
    prompt = `One of the messages in the conversation may be unclear. Explain the meaning of the last user message in simple terms and point out any ambiguous parts. Conversation:\n\n${conversation.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
  } else if (action === "composeReply") {
    const tone = options.tone || "neutral";
    prompt = `Compose a short, context-aware reply in tone: ${tone}. Conversation:\n\n${conversation.map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nReply:`;
  } else {
    prompt = `${action}: ${conversation.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
  }

  try {
    const res = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { text: prompt },
      temperature: 0.3,
      maxOutputTokens: 800,
    });

    const parsed = parseResponse(res);
    if (!parsed) return { result: null };
    if (action === "summarize") return { summary: parsed.trim() };
    if (action === "explain") return { explanation: parsed.trim() };
    if (action === "composeReply") return { reply: parsed.trim() };
    return { result: parsed.trim() };
  } catch (err) {
    console.error("assistantAction error:", err && err.message ? err.message : err);
    return { result: null };
  }
};

export const generateSmartReplies = async (messageText, context = "", tone = "neutral") => {
  const apiKey = getApiKey();
  if (!apiKey) {
    // mock: include tone hint in mock output
    return {
      quickReplies: ["Okay", "Thanks", "Can you explain more?"],
      rewrites: [
        { tone: "short", text: messageText },
        { tone: "creative", text: messageText },
        { tone: "professional", text: messageText },
      ],
    };
  }

  const aiClient = createAiClient(apiKey);
  if (!aiClient) return { quickReplies: ["Okay"], rewrites: [] };

  // If we are in cooldown because of quota errors, return a safe mock quickly
  if (Date.now() < cooldownUntil) {
    console.warn("generateSmartReplies: in cooldown until", new Date(cooldownUntil).toISOString());
    return {
      quickReplies: ["(Temporarily unavailable)"],
      rewrites: [],
      _quotaCoolDown: true,
    };
  }

  // Check cache
  const cacheKey = `${messageText}|${tone}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const prompt = `Read the following message and generate 3 short reply suggestions suitable for quick replies (each 1-8 words) in the tone: ${tone}. Then provide 3 rewrites of the user's draft in different tones: short, creative, professional. Return JSON with keys: quickReplies (array of strings), rewrites (array of {tone, text}). Message:\n"""\n${messageText}\n"""\nContext:\n"""\n${context}\n"""\nRespond ONLY with JSON.`;

  // Try with simple retry/backoff honoring server RetryInfo when available
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const res = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { text: prompt },
        temperature: 0.7,
        maxOutputTokens: 800,
      });

      const parsed = parseResponse(res);
      const result = (function () {
        if (!parsed) return { quickReplies: [], rewrites: [] };
        const jsonStart = parsed.indexOf("{");
        const jsonText = jsonStart > -1 ? parsed.slice(jsonStart) : parsed;
        try {
          const obj = JSON.parse(jsonText);
          return { quickReplies: obj.quickReplies || [], rewrites: obj.rewrites || [] };
        } catch (err) {
          const lines = parsed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
          return { quickReplies: lines.slice(0, 3), rewrites: [] };
        }
      })();

      // On success, reset consecutive429 and cache the result
      consecutive429 = 0;
      cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    } catch (err) {
      // Try to detect quota / 429 and apply retryDelay if provided
      console.error("generateSmartReplies error:", err && (err.message || err));
      const status = err?.response?.status || err?.error?.code || (err?.code ? Number(err.code) : null);
      // Attempt to parse RetryInfo from response details
      const details = err?.response?.data?.details || err?.error?.details || null;
      let retryDelayMs = 0;
      if (Array.isArray(details)) {
        for (const d of details) {
          try {
            if (d && d["@type"] && d["@type"].includes("RetryInfo") && d.retryDelay) {
              retryDelayMs = parseRetryDelay(d.retryDelay);
              break;
            }
            // Some libs embed retry info differently
            if (d && d.retryDelay) {
              retryDelayMs = parseRetryDelay(d.retryDelay);
              break;
            }
          } catch (e) {
            // continue
          }
        }
      }

      if (status === 429) {
        consecutive429 += 1;
        // If server provided a recommended retryDelay, use it; otherwise use exponential backoff
        if (retryDelayMs > 0) {
          cooldownUntil = Date.now() + retryDelayMs;
        } else {
          // exponential backoff capped at 60s
          const backoff = Math.min(60000, 500 * Math.pow(2, consecutive429));
          cooldownUntil = Date.now() + backoff;
        }
        console.warn("Gemini quota hit, entering cooldown until", new Date(cooldownUntil).toISOString());
        // If we have attempts left and a small retryDelay, sleep and retry
        if (retryDelayMs > 0 && attempts < maxAttempts) {
          await sleep(retryDelayMs);
          continue;
        }
        break; // stop retrying
      }

      // For other transient errors, apply small exponential backoff and retry
      if (attempts < maxAttempts) {
        const backoff = 200 * attempts;
        await sleep(backoff);
        continue;
      }
      break;
    }
  }

  // On repeated failures or quota, return mock fallback
  return { quickReplies: [], rewrites: [] };
};

// Backwards-compatible named aliases expected by controllers
export const proofreadAndAdjustTone = proofreadAndTone;
export const assistantConversation = assistantAction;

export async function rewriteMessage(text, style = "neutral") {
  // Use the proofreadAndTone function to get an improved version, then return in a simple shape
  const out = await proofreadAndTone(text, style);
  return { rewritten: out.correctedText || text };
}

export default { proofreadAndTone, assistantAction, generateSmartReplies, rewriteMessage };
