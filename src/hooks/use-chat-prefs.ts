import { useEffect, useState } from "react";

export const CHAT_FONTS = ["Inter", "Roboto", "Open Sans", "Poppins", "Nunito", "Lato"] as const;
export type ChatFont = typeof CHAT_FONTS[number];

interface ChatPrefs {
  font: ChatFont;
  size: number; // 12-18
}

const KEY = "ias.chat.prefs";
const DEFAULTS: ChatPrefs = { font: "Inter", size: 14 };

function keyFor(agentId?: string | null) {
  return agentId ? `${KEY}.${agentId}` : KEY;
}

function read(agentId?: string | null): ChatPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(keyFor(agentId)) ?? localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<ChatPrefs>;
    return {
      font: (CHAT_FONTS.includes(p.font as ChatFont) ? p.font : DEFAULTS.font) as ChatFont,
      size: typeof p.size === "number" && p.size >= 12 && p.size <= 18 ? p.size : DEFAULTS.size,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useChatPrefs(agentId?: string | null) {
  const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(read(agentId));
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyFor(agentId) || e.key === KEY) setPrefs(read(agentId));
    };
    const onCustom = () => setPrefs(read(agentId));
    window.addEventListener("storage", onStorage);
    window.addEventListener("ias:chat-prefs-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ias:chat-prefs-changed", onCustom);
    };
  }, [agentId]);

  const save = (p: ChatPrefs) => {
    localStorage.setItem(keyFor(agentId), JSON.stringify(p));
    setPrefs(p);
    window.dispatchEvent(new Event("ias:chat-prefs-changed"));
  };

  return { prefs, save };
}

export function ensureFontLoaded(font: ChatFont) {
  if (typeof document === "undefined") return;
  const id = `gf-${font.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}
