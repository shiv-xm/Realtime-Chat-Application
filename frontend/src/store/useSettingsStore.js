import { create } from "zustand";

const STORAGE_KEY = "chat_app_settings";

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const save = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

export const useSettingsStore = create((set, get) => {
  const persisted = load();

  const initial = {
    aiSuggestionsEnabled: persisted?.aiSuggestionsEnabled ?? true,
    // renamed: enable automatic AI reply generation per incoming message
    aiRepliesEnabled: persisted?.aiRepliesEnabled ?? false,
    aiTone: persisted?.aiTone ?? "neutral",
  };

  // persist on change
  const proxiedSet = (patch) => {
    set(patch);
    // small timeout to ensure state is applied
    setTimeout(() => {
      const s = get();
      save({
        aiSuggestionsEnabled: s.aiSuggestionsEnabled,
        aiRepliesEnabled: s.aiRepliesEnabled,
        aiTone: s.aiTone,
      });
    }, 0);
  };

  return {
    ...initial,
    setAiSuggestionsEnabled: (v) => proxiedSet({ aiSuggestionsEnabled: v }),
    setAiRepliesEnabled: (v) => proxiedSet({ aiRepliesEnabled: v }),
    setAiTone: (t) => proxiedSet({ aiTone: t }),
  };
});

export default useSettingsStore;
