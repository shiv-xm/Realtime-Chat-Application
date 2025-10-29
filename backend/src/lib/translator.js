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

const parseGeminiResponse = (data) => {
  // The API shape may vary between versions. Try a few known fields.
  // text-bison responses commonly provide `candidates[0].output` or `candidates[0].content`.
  if (!data) return null;

  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const c = data.candidates[0];
    if (typeof c.output === "string") return c.output;
    if (typeof c.content === "string") return c.content;
    // some variants: content may be an array
    if (Array.isArray(c.content) && c.content.length > 0 && typeof c.content[0].text === "string") return c.content[0].text;
  }

  // fallback common shapes
  if (typeof data.output === "string") return data.output;
  if (Array.isArray(data.output) && data.output.length > 0 && typeof data.output[0].content === "string") return data.output[0].content;

  return null;
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
    // Log and return mock translation to avoid breaking message flow
    console.error("translateText error:", err.message || err);
    const translatedText = `[translated to ${targetLanguage || "auto"}] ${text}`;
    return { translatedText, sourceLanguage: "auto", targetLanguage };
  }
};

export default { translateText };
