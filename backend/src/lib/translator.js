// Translator module.
// Attempts to use Google Gemini (Generative Language API) when GEMINI_API_KEY is set.
// Falls back to a deterministic mock translation when no key is configured or the
// external call fails.

import {GoogleGenAI} from "@google/genai";

// Create client lazily when a key is available. Avoid hard-coding any API key in source.
const createAiClient = (apiKey) => {
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error("createAiClient error:", err && err.message ? err.message : err);
    return null;
  }
};

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.5-flash:generateContent";

// Simple cooldown to avoid repeated quota calls when server returns RetryInfo
let cooldownUntil = 0;

const parseRetryDelay = (s) => {
  if (!s) return 0;
  try {
    if (typeof s !== "string") return 0;
    s = s.trim();
    if (s.endsWith("ms")) return parseFloat(s.replace("ms", "")) || 0;
    if (s.endsWith("s")) return (parseFloat(s.replace("s", "")) || 0) * 1000;
    return parseFloat(s) * 1000 || 0;
  } catch (e) {
    return 0;
  }
};

const parseGeminiResponse = (data) => {
  if (!data) return null;

  // candidates array (most common)
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const c = data.candidates[0];

    // candidate.output (string)
    if (typeof c.output === "string" && c.output.trim()) return c.output.trim();

    // candidate.content may be a string, an object with parts, or an array
    if (typeof c.content === "string" && c.content.trim()) return c.content.trim();

    if (c.content && typeof c.content === "object") {
      // content.parts: [{ text }]
      if (Array.isArray(c.content.parts) && c.content.parts.length > 0) {
        return c.content.parts.map((p) => (p?.text || "")).join("").trim();
      }

      // content itself may be an array of chunks
      if (Array.isArray(c.content) && c.content.length > 0) {
        // try to find first element with text
        for (const el of c.content) {
          if (el && typeof el === "object") {
            if (typeof el.text === "string" && el.text.trim()) return el.text.trim();
            if (el?.content && typeof el.content === "string" && el.content.trim()) return el.content.trim();
            if (el?.content && Array.isArray(el.content) && el.content[0]?.text) return el.content.map((p) => p?.text || "").join("").trim();
          }
        }
      }
    }
  }

  // older shapes
  if (typeof data.output === "string" && data.output.trim()) return data.output.trim();
  if (Array.isArray(data.output) && data.output.length > 0) {
    const o = data.output[0];
    if (typeof o.content === "string") return o.content.trim();
    if (o?.content && Array.isArray(o.content) && o.content[0]?.text) return o.content.map((p) => p?.text || "").join("").trim();
  }

  // final fallback: try to stringify and extract text-like content
  try {
    const asText = typeof data === "string" ? data : JSON.stringify(data);
    // remove surrounding JSON if model returned a JSON blob with text key
    const m = asText.match(/"?translated"?\s*[:=]\s*"([\s\S]*?)"/i);
    if (m && m[1]) return m[1].trim();
    return asText.slice(0, 1000).trim();
  } catch (e) {
    return null;
  }
};

export const translateText = async (text, targetLanguage) => {
    console.log(text);
    console.log("targetLanguage:", targetLanguage);

  if (!text) return { translatedText: text, sourceLanguage: null, targetLanguage };

  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();

  if (!apiKey) {
    // No real API configured - deterministic mock for local/dev
    const translatedText = `[translated to ${targetLanguage || "auto"}] ${text}`;
    const sourceLanguage = "auto";
    return { translatedText, sourceLanguage, targetLanguage };
  }

  try {
  // Respect cooldown if previously set due to quota errors
  if (Date.now() < cooldownUntil) {
    console.warn("translateText: in cooldown until", new Date(cooldownUntil).toISOString());
    const translatedText = `[translated to ${targetLanguage || "auto"}] ${text}`;
    return { translatedText, sourceLanguage: "auto", targetLanguage };
  }
  const promptText = `Translate the following text into the language with ISO code "${targetLanguage}". Reply ONLY with the translated text, do not add explanations:\n\n${text}`;

 
    // Create a client only when apiKey is set. If unavailable or client creation fails,
    // fall back to the deterministic mock translation below.
    const aiClient = createAiClient(apiKey);

    if (!aiClient) {
      console.warn("No Gemini client configured; returning mock translation");
      const translatedText = `[translated to ${targetLanguage || "auto"}] ${text}`;
      return { translatedText, sourceLanguage: "auto", targetLanguage };
    }

    // Use the client API. The genai client returns a response which may contain
    // candidates/content/parts depending on version — try to parse common shapes.
    const res = await aiClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { text: promptText },
      temperature: 0.0,
      maxOutputTokens: 1024,
    });

    console.log("response:", res);

    const translated =
      res?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ||
      parseGeminiResponse(res) ||
      null;
    console.log("translated:", translated);

    if (!translated) {
      // if parsing failed, fall back to a safe mock
      const translatedText = `[translated to ${targetLanguage || "auto"}] ${text}`;
      return { translatedText, sourceLanguage: "auto", targetLanguage };
    }

    // Trim any surrounding quotes/newlines
    const translatedText = String(translated).trim();
    const sourceLanguage = "auto";
    return { translatedText, sourceLanguage, targetLanguage };
  } catch (err) {
    // Detect quota / retry info and set a cooldown if provided by the service
    try {
      const details = err?.response?.data?.details || err?.error?.details || null;
      if (Array.isArray(details)) {
        for (const d of details) {
          try {
            if (d && d["@type"] && d["@type"].includes("RetryInfo") && d.retryDelay) {
              const delayMs = parseRetryDelay(d.retryDelay);
              if (delayMs > 0) {
                cooldownUntil = Date.now() + delayMs;
                console.warn("translateText: entering cooldown for", delayMs, "ms");
              }
            }
          } catch (e) {
            // continue
          }
        }
      }
    } catch (e) {
      // ignore
    }

    console.error("translateText error:", err?.message || err || "unknown");
    const translatedText = `[translated to ${targetLanguage || "auto"}] ${text}`;
    return { translatedText, sourceLanguage: "auto", targetLanguage };
  }
};

export default { translateText };
