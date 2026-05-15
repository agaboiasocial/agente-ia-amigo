import { Fragment, type ReactNode } from "react";

interface FormattedMessageProps {
  text: string;
  className?: string;
}

// ---- Inline formatter: bold / italic / strike / inline code / link ----
function formatInline(text: string, keyPrefix = ""): ReactNode[] {
  // Tokenize while preserving order; precedence: code > link > bold > italic > strike
  const tokens: { type: string; content: string; href?: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);

    // inline code `...`
    let m = rest.match(/^`([^`\n]+)`/);
    if (m) {
      tokens.push({ type: "code", content: m[1] });
      i += m[0].length;
      continue;
    }

    // link [text](url)
    m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (m) {
      tokens.push({ type: "link", content: m[1], href: m[2] });
      i += m[0].length;
      continue;
    }

    // raw url
    m = rest.match(/^https?:\/\/[^\s<>()]+/);
    if (m) {
      tokens.push({ type: "link", content: m[0], href: m[0] });
      i += m[0].length;
      continue;
    }

    // bold *...*  or **...**
    m = rest.match(/^\*\*([^*\n]+)\*\*/) || rest.match(/^\*([^*\n]+)\*/);
    if (m) {
      tokens.push({ type: "bold", content: m[1] });
      i += m[0].length;
      continue;
    }

    // italic _..._
    m = rest.match(/^_([^_\n]+)_/);
    if (m) {
      tokens.push({ type: "italic", content: m[1] });
      i += m[0].length;
      continue;
    }

    // strike ~...~
    m = rest.match(/^~([^~\n]+)~/);
    if (m) {
      tokens.push({ type: "strike", content: m[1] });
      i += m[0].length;
      continue;
    }

    // plain char — accumulate
    const last = tokens[tokens.length - 1];
    if (last && last.type === "text") last.content += text[i];
    else tokens.push({ type: "text", content: text[i] });
    i++;
  }

  return tokens.map((t, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (t.type) {
      case "bold":
        return <strong key={key}>{t.content}</strong>;
      case "italic":
        return <em key={key}>{t.content}</em>;
      case "strike":
        return (
          <span key={key} style={{ textDecoration: "line-through" }}>
            {t.content}
          </span>
        );
      case "code":
        return (
          <code
            key={key}
            className="font-mono text-[0.85em] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--chat-code-inline)",
              color: "var(--chat-code-inline-foreground)",
            }}
          >
            {t.content}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={t.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-success underline underline-offset-2"
          >
            {t.content}
          </a>
        );
      default:
        return <Fragment key={key}>{t.content}</Fragment>;
    }
  });
}

// ---- Block-level renderer ----
export function FormattedMessage({ text, className }: FormattedMessageProps) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // code fence ```
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={`b${blocks.length}`}
          className="font-mono text-[0.85em] my-2 p-3 rounded-lg overflow-x-auto"
          style={{
            background: "var(--chat-code-block)",
            color: "var(--chat-code-block-foreground)",
          }}
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`b${blocks.length}`}
          className="my-1 rounded-r-md border-l-[3px] border-success bg-[var(--chat-quote-bg)] py-1 pl-3 text-sm"
        >
          {buf.map((l, k) => (
            <div key={k}>{formatInline(l, `q${blocks.length}-${k}`)}</div>
          ))}
        </blockquote>,
      );
      continue;
    }

    // unordered list
    if (/^[-*] /.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        buf.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      blocks.push(
        <ul key={`b${blocks.length}`} className="list-disc pl-5 my-1 space-y-0.5">
          {buf.map((l, k) => (
            <li key={k}>{formatInline(l, `u${blocks.length}-${k}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // ordered list
    if (/^\d+\.\s/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        buf.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={`b${blocks.length}`} className="list-decimal pl-5 my-1 space-y-0.5">
          {buf.map((l, k) => (
            <li key={k}>{formatInline(l, `o${blocks.length}-${k}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // empty line
    if (line.trim() === "") {
      blocks.push(<div key={`b${blocks.length}`} className="h-2" />);
      i++;
      continue;
    }

    // paragraph
    blocks.push(
      <div key={`b${blocks.length}`} className="whitespace-pre-wrap break-words">
        {formatInline(line, `p${blocks.length}`)}
      </div>,
    );
    i++;
  }

  return <div className={className}>{blocks}</div>;
}
