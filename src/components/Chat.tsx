"use client";

import { useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import type { ChatMessage } from "@/lib/types";

/** Reads a streamed text/plain response, calling onText with the growing string. */
export async function streamText(url: string, body: unknown, onText: (s: string) => void) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += dec.decode(value, { stream: true });
    onText(acc);
  }
  return acc;
}

interface Props {
  endpoint: string;
  extraBody?: Record<string, unknown>;
  initial?: ChatMessage[];
  onMessagesChange?: (m: ChatMessage[]) => void;
  suggestions: string[];
  placeholder?: string;
  /** called right before sending, e.g. to flush unsaved notes */
  beforeSend?: () => Promise<void>;
  compact?: boolean;
}

export function Chat({ endpoint, extraBody, initial = [], onMessagesChange, suggestions, placeholder, beforeSend, compact }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const history: ChatMessage[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    try {
      await beforeSend?.();
      const answer = await streamText(endpoint, { ...extraBody, messages: history }, (s) =>
        setMessages([...history, { role: "assistant", content: s }]),
      );
      const final = [...history, { role: "assistant" as const, content: answer }];
      setMessages(final);
      onMessagesChange?.(final);
    } catch (e) {
      setError((e as Error).message);
      setMessages(history.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setMessages([]);
    onMessagesChange?.([]);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex-1 overflow-y-auto space-y-4 ${compact ? "p-4" : "py-6"}`}>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-line bg-panel px-3 py-1.5 text-sm text-ink-soft hover:border-accent hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink text-paper px-3.5 py-2 text-[15px] whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="max-w-full">
              {m.content ? <Markdown>{m.content}</Markdown> : <Thinking />}
              {m.content && !busy && (
                <button onClick={() => navigator.clipboard.writeText(m.content)} className="mt-1 text-xs text-muted hover:text-ink">
                  Copy
                </button>
              )}
            </div>
          ),
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className={`flex items-end gap-2 ${compact ? "border-t border-line p-3" : "pb-4"}`}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={placeholder ?? "Ask anything…"}
          className="flex-1 resize-none rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[15px] outline-none focus:border-accent max-h-40"
        />
        {messages.length > 0 && (
          <button type="button" onClick={clear} className="rounded-xl px-2 py-2.5 text-xs text-muted hover:text-ink" title="Clear chat">
            Clear
          </button>
        )}
        <button
          disabled={busy || !input.trim()}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-1 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}
