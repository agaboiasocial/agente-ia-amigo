import { useEffect, useRef, type CSSProperties } from "react";
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, SquareCode, Link as LinkIcon,
} from "lucide-react";

type WrapKind = "bold" | "italic" | "strike" | "code" | "codeblock" | "ul" | "ol" | "quote" | "link";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  fontFamily?: string;
  fontSize?: number;
  noteMode?: boolean;
}

export function MessageComposer({
  value, onChange, onSubmit, placeholder, fontFamily, fontSize, noteMode,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow 2..6 lines
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    const lh = (fontSize ?? 14) * 1.5;
    const min = lh * 2 + 12;
    const max = lh * 6 + 12;
    el.style.height = Math.min(max, Math.max(min, el.scrollHeight)) + "px";
  }, [value, fontSize]);

  const wrap = (kind: WrapKind) => {
    const el = ref.current; if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = value.slice(start, end);
    let before = "", after = "", replacement = sel;
    let wholeLine = false;

    switch (kind) {
      case "bold": before = after = "*"; break;
      case "italic": before = after = "_"; break;
      case "strike": before = after = "~"; break;
      case "code": before = after = "`"; break;
      case "codeblock": before = "```\n"; after = "\n```"; break;
      case "link": {
        const url = window.prompt("URL do link:", "https://");
        if (!url) return;
        before = "["; after = `](${url})`;
        if (!sel) replacement = "texto";
        break;
      }
      case "ul": {
        wholeLine = true;
        const lines = (sel || "item").split("\n");
        replacement = lines.map((l) => `- ${l}`).join("\n");
        break;
      }
      case "ol": {
        wholeLine = true;
        const lines = (sel || "item").split("\n");
        replacement = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
        break;
      }
      case "quote": {
        wholeLine = true;
        const lines = (sel || "citação").split("\n");
        replacement = lines.map((l) => `> ${l}`).join("\n");
        break;
      }
    }

    const next = value.slice(0, start) + before + replacement + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = wholeLine
        ? start + before.length + replacement.length + after.length
        : start + before.length + replacement.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const k = e.key.toLowerCase();
      if (k === "b") { e.preventDefault(); wrap("bold"); }
      else if (k === "i") { e.preventDefault(); wrap("italic"); }
      else if (k === "e") { e.preventDefault(); wrap("code"); }
      else if (k === "k") { e.preventDefault(); wrap("link"); }
    }
  };

  const Btn = ({ k, title, children }: { k: WrapKind; title: string; children: React.ReactNode }) => (
    <button type="button" onClick={() => wrap(k)} title={title}
      className="h-7 w-7 grid place-items-center rounded-md transition-colors text-[#6B7280] hover:bg-background hover:text-[#2FAE7C]">
      {children}
    </button>
  );
  const Sep = () => <span className="w-px h-4 bg-border mx-1" />;

  const taStyle: CSSProperties = {
    fontFamily: fontFamily ? `${fontFamily}, system-ui, sans-serif` : undefined,
    fontSize: fontSize ? `${fontSize}px` : undefined,
    lineHeight: 1.5,
  };

  return (
    <div className={`rounded-xl border bg-background ${noteMode ? "ring-1 ring-warning/50" : ""}`}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b">
        <Btn k="bold" title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn k="italic" title="Itálico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn k="strike" title="Tachado"><Strikethrough className="h-3.5 w-3.5" /></Btn>
        <Btn k="code" title="Código inline (Ctrl+E)"><Code className="h-3.5 w-3.5" /></Btn>
        <Sep />
        <Btn k="ul" title="Lista"><List className="h-3.5 w-3.5" /></Btn>
        <Btn k="ol" title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn k="quote" title="Citação"><Quote className="h-3.5 w-3.5" /></Btn>
        <Sep />
        <Btn k="codeblock" title="Bloco de código"><SquareCode className="h-3.5 w-3.5" /></Btn>
        <Btn k="link" title="Inserir link (Ctrl+K)"><LinkIcon className="h-3.5 w-3.5" /></Btn>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder ?? "Digite sua mensagem... (use * para negrito, _ para itálico)"}
        rows={2}
        style={taStyle}
        className="block w-full resize-none bg-transparent px-3 py-2 text-sm focus:outline-none"
      />
    </div>
  );
}
