"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, notifyChanged } from "@/components/api";
import { Chat } from "@/components/Chat";
import { useTranscriber } from "@/components/useTranscriber";
import { fmtDate, fmtTimestamp, meetingToMarkdown } from "@/lib/format";
import type { Folder, Meeting, Template, TranscriptSegment } from "@/lib/types";

type Panel = "none" | "transcript" | "chat";
const SAVE_FIELDS = ["title", "notes", "attendees", "transcript", "recordedMs", "folderId", "templateId", "enhanced", "chat"] as const;

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const [m, setM] = useState<Meeting | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [view, setView] = useState<"enhanced" | "notes">("notes");
  const [panel, setPanel] = useState<Panel>("none");
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // ---- load ---------------------------------------------------------------
  useEffect(() => {
    api<Meeting>(`/api/meetings/${id}`)
      .then((x) => {
        setM(x);
        setView(x.enhanced ? "enhanced" : "notes");
      })
      .catch(() => setNotFound(true));
    api<Folder[]>("/api/folders").then(setFolders).catch(() => {});
    api<Template[]>("/api/templates").then(setTemplates).catch(() => {});
  }, [id]);

  // ---- autosave -------------------------------------------------------------
  const latest = useRef<Meeting | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  latest.current = m;

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current || !latest.current) return;
    dirty.current = false;
    setSaved("saving");
    const body = Object.fromEntries(SAVE_FIELDS.map((k) => [k, latest.current![k]]));
    try {
      await api(`/api/meetings/${id}`, { method: "PATCH", json: body });
      setSaved("saved");
    } catch {
      dirty.current = true;
      setSaved("error");
    }
  }, [id]);

  const update = useCallback(
    (patch: Partial<Meeting> | ((prev: Meeting) => Partial<Meeting>)) => {
      setM((prev) => (prev ? { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) } : prev));
      dirty.current = true;
      setSaved("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, 700);
    },
    [flush],
  );

  useEffect(() => {
    const onUnload = () => {
      if (dirty.current && latest.current) {
        const body = Object.fromEntries(SAVE_FIELDS.map((k) => [k, latest.current![k]]));
        void fetch(`/api/meetings/${id}`, { method: "PATCH", body: JSON.stringify(body), keepalive: true, headers: { "Content-Type": "application/json" } });
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [id, flush]);

  // ---- transcription ----------------------------------------------------------
  const onSegment = useCallback((s: TranscriptSegment) => update((prev) => ({ transcript: [...prev.transcript, s] })), [update]);
  const onElapsed = useCallback((ms: number) => update({ recordedMs: ms }), [update]);
  const tx = useTranscriber({ baseMs: m?.recordedMs ?? 0, onSegment, onElapsed });

  const autoStarted = useRef(false);
  useEffect(() => {
    if (m && search.get("record") === "1" && !autoStarted.current) {
      autoStarted.current = true;
      router.replace(`/meetings/${id}`);
      void tx.start();
    }
  }, [m, search, router, id, tx]);

  // ---- actions --------------------------------------------------------------
  async function enhance(templateId?: string) {
    if (!m) return;
    if (tx.recording) tx.stop();
    setError(null);
    setEnhancing(true);
    setView("enhanced");
    try {
      await flush();
      const updated = await api<Meeting>(`/api/meetings/${id}/enhance`, {
        method: "POST",
        json: { templateId: templateId ?? m.templateId },
      });
      setM((prev) => (prev ? { ...prev, enhanced: updated.enhanced, title: updated.title, templateId: updated.templateId } : updated));
      notifyChanged();
    } catch (e) {
      setError((e as Error).message);
      if (!m.enhanced) setView("notes");
    } finally {
      setEnhancing(false);
    }
  }

  async function toggleShare() {
    if (!m) return;
    const { shareId } = await api<{ shareId: string | null }>(`/api/meetings/${id}/share`, {
      method: "POST",
      json: { enabled: !m.shareId },
    });
    setM({ ...m, shareId });
    if (shareId) {
      const url = `${location.origin}/share/${shareId}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      flash("Public link copied to clipboard");
    } else flash("Link disabled");
  }

  async function remove() {
    if (!confirmDelete.current) {
      confirmDelete.current = true;
      flash("Click delete again to confirm");
      setTimeout(() => (confirmDelete.current = false), 3000);
      return;
    }
    tx.stop();
    dirty.current = false;
    await api(`/api/meetings/${id}`, { method: "DELETE" });
    notifyChanged();
    router.push("/");
  }
  const confirmDelete = useRef(false);

  function flash(s: string) {
    setToast(s);
    setTimeout(() => setToast(null), 2200);
  }

  if (notFound)
    return (
      <div className="p-10 text-ink-soft">
        Note not found. <Link href="/" className="text-frost underline">Go home</Link>
      </div>
    );
  if (!m) return <div className="p-10 text-muted">Loading…</div>;

  const hasContent = m.notes.trim() || m.transcript.length;

  return (
    <div className="flex h-screen">
      {/* ---------------- main column ---------------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* toolbar */}
        <div className="flex items-center gap-2 border-b border-line px-4 md:px-8 py-2.5 text-sm">
          <Link href="/" className="text-muted hover:text-ink">← Notes</Link>
          <span className="flex-1" />
          <span className="text-xs text-muted hidden sm:inline">
            {saved === "saving" ? "Saving…" : saved === "error" ? "Save failed — retrying" : "Saved"}
          </span>
          <select
            value={m.folderId ?? ""}
            onChange={(e) => {
              update({ folderId: e.target.value || null });
              setTimeout(notifyChanged, 900);
            }}
            className="rounded-md border border-line bg-panel px-2 py-1 text-sm"
            title="Folder"
          >
            <option value="">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>📁 {f.name}</option>
            ))}
          </select>
          <button onClick={toggleShare} className={`rounded-md border px-2.5 py-1 ${m.shareId ? "border-frost text-frost" : "border-line"}`}>
            {m.shareId ? "Shared ✓" : "Share"}
          </button>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="rounded-md border border-line px-2 py-1">⋯</button>
            {menu && (
              <div className="absolute right-0 mt-1 w-52 rounded-lg border border-line bg-panel shadow-lg z-20 py-1" onMouseLeave={() => setMenu(false)}>
                <MenuItem onClick={() => { navigator.clipboard.writeText(meetingToMarkdown(m)); flash("Copied as Markdown"); setMenu(false); }}>Copy notes as Markdown</MenuItem>
                {m.shareId && (
                  <MenuItem onClick={() => { navigator.clipboard.writeText(`${location.origin}/share/${m.shareId}`); flash("Link copied"); setMenu(false); }}>Copy share link</MenuItem>
                )}
                <MenuItem onClick={() => { const b = new Blob([meetingToMarkdown(m)], { type: "text/markdown" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${(m.title || "meeting").replace(/[^\w\- ]+/g, "")}.md`; a.click(); setMenu(false); }}>Download .md</MenuItem>
                <MenuItem danger onClick={remove}>Delete note</MenuItem>
              </div>
            )}
          </div>
        </div>

        {/* document */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 md:px-8 pt-8 pb-40">
            <input
              value={m.title}
              onChange={(e) => update({ title: e.target.value })}
              onBlur={() => notifyChanged()}
              placeholder="New note"
              className="w-full bg-transparent font-serif text-3xl font-semibold tracking-tight outline-none placeholder:text-muted/60"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>📅 {fmtDate(m.scheduledAt ?? m.createdAt)}</span>
              <Attendees value={m.attendees} onChange={(attendees) => update({ attendees })} />
            </div>

            {(m.enhanced || enhancing) && (
              <div className="mt-6 inline-flex rounded-lg border border-line bg-sunken p-0.5 text-sm">
                <Tab active={view === "enhanced"} onClick={() => setView("enhanced")}>✨ Enhanced</Tab>
                <Tab active={view === "notes"} onClick={() => setView("notes")}>My notes</Tab>
              </div>
            )}

            {error && <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

            <div className="mt-5">
              {view === "enhanced" ? (
                enhancing ? (
                  <EnhancingSkeleton />
                ) : m.enhanced ? (
                  <EnhancedView
                    meeting={m}
                    onChange={(enhanced) => update({ enhanced })}
                  />
                ) : null
              ) : (
                <NotesEditor value={m.notes} onChange={(notes) => update({ notes })} recording={tx.recording} />
              )}
            </div>
          </div>
        </div>

        {/* floating control bar */}
        <div className="pointer-events-none sticky bottom-0 flex justify-center pb-5 px-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-panel/95 backdrop-blur px-2 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
            <RecordButton tx={tx} />
            <BarButton active={panel === "transcript"} onClick={() => setPanel(panel === "transcript" ? "none" : "transcript")}>
              Transcript{m.transcript.length ? ` · ${m.transcript.length}` : ""}
            </BarButton>
            <div className="flex items-center rounded-xl bg-accent-soft">
              <button
                disabled={enhancing || !hasContent}
                onClick={() => enhance()}
                className="rounded-l-xl px-3 py-1.5 text-sm font-medium text-accent disabled:opacity-40"
                title={hasContent ? "Combine your notes with the transcript" : "Write notes or record first"}
              >
                {enhancing ? "Enhancing…" : m.enhanced ? "✨ Regenerate" : "✨ Enhance notes"}
              </button>
              <select
                value={m.templateId}
                disabled={enhancing}
                onChange={(e) => {
                  update({ templateId: e.target.value });
                  if (m.enhanced) void enhance(e.target.value);
                }}
                className="rounded-r-xl border-l border-accent/20 bg-transparent px-1.5 py-1.5 text-xs text-accent outline-none"
                title="Template"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <BarButton active={panel === "chat"} onClick={() => setPanel(panel === "chat" ? "none" : "chat")}>Ask ✦</BarButton>
          </div>
        </div>
        {tx.error && <p className="text-center text-xs text-danger pb-2 -mt-3">{tx.error}</p>}
        {!tx.supported && <p className="text-center text-xs text-muted pb-2 -mt-3">Live transcription needs Chrome, Edge or Safari. You can still take notes and enhance them.</p>}
      </div>

      {/* ---------------- side panel ---------------- */}
      {panel !== "none" && (
        <aside className="fixed inset-0 z-30 md:static md:z-auto md:w-[380px] shrink-0 border-l border-line bg-panel flex flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <div className="flex gap-1 text-sm">
              <Tab active={panel === "transcript"} onClick={() => setPanel("transcript")}>Transcript</Tab>
              <Tab active={panel === "chat"} onClick={() => setPanel("chat")}>Ask</Tab>
            </div>
            <button onClick={() => setPanel("none")} className="text-muted hover:text-ink px-1">✕</button>
          </div>
          {panel === "transcript" ? (
            <TranscriptPanel
              segments={m.transcript}
              interim={tx.interim}
              recording={tx.recording}
              onToggleSpeaker={(sid) =>
                update((prev) => ({
                  transcript: prev.transcript.map((s) => (s.id === sid ? { ...s, speaker: s.speaker === "me" ? "them" : "me" } : s)),
                }))
              }
              onPaste={(text) => update((prev) => ({ transcript: [...prev.transcript, ...parsePasted(text, prev.recordedMs)] }))}
            />
          ) : (
            <Chat
              compact
              endpoint={`/api/meetings/${id}/chat`}
              initial={m.chat}
              beforeSend={flush}
              onMessagesChange={(chat) => update({ chat })}
              suggestions={["Write a follow-up email", "What are the action items?", "What did I miss?", "Summarize key decisions", "Draft a Slack recap"]}
              placeholder={`Ask about ${m.title || "this meeting"}…`}
            />
          )}
        </aside>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 rounded-lg bg-ink text-paper px-3 py-1.5 text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}

/* ======================================================================== */

function NotesEditor({ value, onChange, recording }: { value: string; onChange: (v: string) => void; recording: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(320, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        recording
          ? "Listening… jot down anything important. Short fragments are fine — FrostedFlakes fills in the rest from the transcript."
          : "Write notes here. Hit record to transcribe the meeting, then ✨ Enhance to turn rough notes into great ones."
      }
      className="ff-notes w-full text-[16px] leading-7 placeholder:text-muted/70"
    />
  );
}

function EnhancedView({ meeting, onChange }: { meeting: Meeting; onChange: (e: NonNullable<Meeting["enhanced"]>) => void }) {
  const e = meeting.enhanced!;
  const edit = (si: number, ii: number, text: string) => {
    const sections = e.sections.map((s, a) =>
      a !== si ? s : { ...s, items: text.trim() ? s.items.map((it, b) => (b === ii ? { ...it, text } : it)) : s.items.filter((_, b) => b !== ii) },
    );
    onChange({ ...e, sections });
  };
  return (
    <div className="text-[16px] leading-7">
      {e.summary && <p className="mb-5 rounded-lg bg-sunken px-4 py-3 text-ink-soft">{e.summary}</p>}
      {e.sections.map((s, si) => (
        <section key={si} className="mb-5">
          <h3 className="font-semibold text-ink mb-1">{s.heading}</h3>
          <ul className="list-disc pl-5 space-y-0.5">
            {s.items.map((it, ii) => (
              <li
                key={`${si}-${ii}-${it.text.slice(0, 12)}`}
                contentEditable
                suppressContentEditableWarning
                onBlur={(ev) => {
                  const t = ev.currentTarget.textContent ?? "";
                  if (t !== it.text) edit(si, ii, t);
                }}
                className={`outline-none rounded px-0.5 focus:bg-sunken ${it.source === "user" ? "text-ink" : "text-muted"}`}
                title={it.source === "user" ? "From your notes" : "Added from the transcript"}
              >
                {it.text}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {e.action_items.length > 0 && (
        <section className="mb-5">
          <h3 className="font-semibold text-ink mb-1">Action Items</h3>
          <ul className="space-y-1">
            {e.action_items.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" className="mt-2 accent-[var(--accent)]" />
                <span>
                  {a.task}
                  {a.owner && <span className="ml-2 rounded-full bg-frost-soft px-2 py-0.5 text-xs text-frost">{a.owner}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 flex items-center gap-4 text-xs text-muted border-t border-line pt-3">
        <span><span className="text-ink">●</span> your notes</span>
        <span><span className="text-muted">●</span> added by FrostedFlakes</span>
        <span className="flex-1" />
        <span>Click any line to edit</span>
      </p>
    </div>
  );
}

function EnhancingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <p className="text-sm text-accent">✨ Combining your notes with the transcript…</p>
      {[70, 90, 60, 0, 40, 85, 75, 0, 55, 80].map((w, i) =>
        w ? <div key={i} className="h-3.5 rounded bg-sunken" style={{ width: `${w}%` }} /> : <div key={i} className="h-3" />,
      )}
    </div>
  );
}

function TranscriptPanel({
  segments, interim, recording, onToggleSpeaker, onPaste,
}: {
  segments: TranscriptSegment[];
  interim: string;
  recording: boolean;
  onToggleSpeaker: (id: string) => void;
  onPaste: (text: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [segments.length, interim]);
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 text-sm">
      {segments.length === 0 && !interim && !pasting && (
        <div className="text-muted space-y-3">
          <p>{recording ? "Listening… start talking." : "No transcript yet. Hit record — FrostedFlakes listens through your device, no bot joins the call."}</p>
          <button onClick={() => setPasting(true)} className="text-frost underline text-xs">Or paste a transcript</button>
        </div>
      )}
      {segments.map((s) => (
        <div key={s.id} className={`flex gap-2 ${s.speaker === "me" ? "flex-row-reverse" : ""}`}>
          <div className={`max-w-[85%] rounded-xl px-3 py-1.5 ${s.speaker === "me" ? "bg-frost-soft" : "bg-sunken"}`}>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <button onClick={() => onToggleSpeaker(s.id)} title="Switch speaker" className="hover:text-ink">
                {s.speaker === "me" ? "Me" : "Them"} ⇄
              </button>
              <span>{fmtTimestamp(s.t)}</span>
            </div>
            <p className="leading-snug">{s.text}</p>
          </div>
        </div>
      ))}
      {interim && (
        <div className="flex flex-row-reverse">
          <p className="max-w-[85%] rounded-xl bg-frost-soft/60 px-3 py-1.5 italic text-ink-soft">{interim}</p>
        </div>
      )}
      {pasting && (
        <div className="space-y-2">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"Paste a transcript. Lines like “Me: …” or “Them: …” keep speakers."}
            className="w-full rounded-lg border border-line bg-paper p-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <button onClick={() => { onPaste(text); setText(""); setPasting(false); }} className="rounded-md bg-accent px-3 py-1 text-white text-sm">Add</button>
            <button onClick={() => setPasting(false)} className="rounded-md px-3 py-1 text-sm text-muted">Cancel</button>
          </div>
        </div>
      )}
      {segments.length > 0 && !pasting && (
        <button onClick={() => setPasting(true)} className="text-xs text-muted hover:text-ink">+ Paste more transcript</button>
      )}
      <div ref={bottom} />
    </div>
  );
}

function parsePasted(text: string, baseMs: number): TranscriptSegment[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const mm = line.match(/^(?:\[[^\]]*\]\s*)?([^:]{1,40}):\s*(.+)$/);
      const who = mm?.[1].trim().toLowerCase();
      const speaker: "me" | "them" = who === "me" || who === "you" ? "me" : "them";
      return { id: `p${Date.now().toString(36)}${i}`, speaker, text: mm ? mm[2] : line, t: baseMs + i * 1000 };
    });
}

function RecordButton({ tx }: { tx: ReturnType<typeof useTranscriber> }) {
  if (tx.recording)
    return (
      <button onClick={tx.stop} className="flex items-center gap-2 rounded-xl bg-ink px-3 py-1.5 text-sm text-paper" title="Stop transcribing">
        <span className="flex h-4 items-center gap-[2px]">
          {tx.levels.map((l, i) => (
            <span key={i} className="w-[3px] rounded-full bg-accent transition-[height] duration-75" style={{ height: `${Math.max(3, l * 16)}px` }} />
          ))}
        </span>
        <span className="tabular-nums">{fmtTimestamp(tx.elapsed)}</span>
        <span className="h-2.5 w-2.5 rounded-[3px] bg-paper" />
      </button>
    );
  return (
    <button
      onClick={() => void tx.start()}
      disabled={!tx.supported}
      className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-40"
      title="Transcribe this meeting"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
      {tx.elapsed > 0 ? `Resume · ${fmtTimestamp(tx.elapsed)}` : "Record"}
    </button>
  );
}

function Attendees({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const names = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (names.length) onChange([...value, ...names.filter((n) => !value.includes(n))]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span>👥</span>
      {value.map((a) => (
        <span key={a} className="group flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-soft">
          {a}
          <button onClick={() => onChange(value.filter((x) => x !== a))} className="opacity-0 group-hover:opacity-100 text-muted hover:text-ink">×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={value.length ? "+" : "Add attendees"}
        className="w-28 bg-transparent text-xs outline-none placeholder:text-muted"
      />
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-md px-3 py-1 ${active ? "bg-panel text-ink shadow-sm font-medium" : "text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

function BarButton({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-xl px-3 py-1.5 text-sm ${active ? "bg-sunken text-ink" : "text-ink-soft hover:bg-sunken"}`}>
      {children}
    </button>
  );
}

function MenuItem({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-sunken ${danger ? "text-danger" : ""}`}>
      {children}
    </button>
  );
}
