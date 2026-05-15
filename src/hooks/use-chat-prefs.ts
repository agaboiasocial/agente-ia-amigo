import { useEffect, useState } from "react";

export const CHAT_FONTS = ["Inter", "Roboto", "Open Sans", "Poppins", "Nunito", "Lato"] as const;
export type ChatFont = typeof CHAT_FONTS[number];

interface ChatPrefs {
  font: ChatFont;
  size: number; // 12-18
}

const KEY = "ias.chat.prefs";
const DEFAULTS: ChatPrefs = { font: "Inter", size: 14 };

function read(): ChatPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
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

export function useChatPrefs() {
  const [prefs, setPrefs] = useState<ChatPrefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPrefs(read());
    };
    const onCustom = () => setPrefs(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener("ias:chat-prefs-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ias:chat-prefs-changed", onCustom);
    };
  }, []);

  const save = (p: ChatPrefs) => {
    localStorage.setItem(KEY, JSON.stringify(p));
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
