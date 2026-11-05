"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, notifyChanged } from "@/components/api";
import { dayLabel, fmtTime } from "@/lib/format";
import type { CalendarEvent, Folder, Meeting } from "@/lib/types";

type Row = Omit<Meeting, "transcript" | "chat"> & { transcriptCount: number };

export default function HomePage() {
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
}

function Home() {
  const router = useRouter();
  const search = useSearchParams();
  const folderId = search.get("folder");
  const q = search.get("q");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [cal, setCal] = useState<{ connected: boolean; events: CalendarEvent[]; error?: string } | null>(null);
  const [renaming, setRenaming] = useState(false);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (folderId) p.set("folder", folderId);
    if (q) p.set("q", q);
    api<Row[]>(`/api/meetings?${p}`).then(setRows).catch(() => setRows([]));
  }, [folderId, q]);

  useEffect(() => {
    load();
    window.addEventListener("ff:changed", load);
    return () => window.removeEventListener("ff:changed", load);
  }, [load]);

  useEffect(() => {
    if (!folderId) return setFolder(null);
    api<Folder[]>("/api/folders").then((fs) => setFolder(fs.find((f) => f.id === folderId) ?? null));
  }, [folderId]);

  useEffect(() => {
    if (!folderId && !q) api<typeof cal>("/api/calendar").then(setCal).catch(() => {});
  }, [folderId, q]);

  async function openEvent(e: CalendarEvent, record: boolean) {
    const m = await api<Meeting>("/api/meetings", {
      method: "POST",
      json: { title: e.title, attendees: e.attendees, scheduledAt: e.start, calendarEventId: e.id },
    });
    notifyChanged();
    router.push(`/meetings/${m.id}${record ? "?record=1" : ""}`);
  }

  async function newNote() {
    const m = await api<Meeting>("/api/meetings", { method: "POST", json: { folderId } });
    notifyChanged();
    router.push(`/meetings/${m.id}?record=1`);
  }

  const groups = new Map<string, Row[]>();
  for (const r of rows ?? []) {
    const k = dayLabel(r.scheduledAt ?? r.createdAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const now = Date.now();
  const upcoming = (cal?.events ?? []).filter((e) => new Date(e.end).getTime() > now).slice(0, 6);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          {folder ? (
            renaming ? (
              <input
                autoFocus
                defaultValue={folder.name}
                onBlur={async (e) => {
                  await api(`/api/folders/${folder.id}`, { method: "PATCH", json: { name: e.target.value } });
                  setFolder({ ...folder, name: e.target.value });
                  setRenaming(false);
                  notifyChanged();
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="font-serif text-3xl font-semibold bg-transparent outline-none border-b border-accent"
              />
            ) : (
              <h1 className="font-serif text-3xl font-semibold tracking-tight" onDoubleClick={() => setRenaming(true)}>📁 {folder.name}</h1>
            )
          ) : q ? (
            <h1 className="font-serif text-3xl font-semibold tracking-tight">Results for “{q}”</h1>
          ) : (
            <h1 className="font-serif text-3xl font-semibold tracking-tight">Good {greeting()}</h1>
          )}
          <p className="mt-1 text-sm text-muted">
            {folder ? (
              <>
                {rows?.length ?? 0} notes ·{" "}
                <button className="hover:text-ink" onClick={() => setRenaming(true)}>Rename</button> ·{" "}
                <Link className="hover:text-ink" href={`/ask?folder=${folder.id}`}>Ask this folder</Link> ·{" "}
                <button
                  className="hover:text-danger"
                  onClick={async () => {
                    await api(`/api/folders/${folder.id}`, { method: "DELETE" });
                    notifyChanged();
                    router.push("/");
                  }}
                >
                  Delete folder
                </button>
              </>
            ) : (
              "Take notes like you always do. FrostedFlakes listens and makes them great."
            )}
          </p>
        </div>
        <button onClick={newNote} className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-paper hover:opacity-90">
          + New note
        </button>
      </div>

      {/* Upcoming meetings */}
      {!folderId && !q && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-wide text-muted mb-2">Coming up</h2>
          {!cal ? (
            <div className="h-16 rounded-xl bg-sunken animate-pulse" />
          ) : !cal.connected ? (
            <Link href="/settings" className="block rounded-xl border border-dashed border-line px-4 py-4 text-sm text-ink-soft hover:border-accent">
              📅 Connect your calendar to see upcoming meetings and start notes in one click →
            </Link>
          ) : cal.error ? (
            <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-danger">Calendar error: {cal.error}</p>
          ) : upcoming.length === 0 ? (
            <p className="rounded-xl bg-sunken px-4 py-3 text-sm text-muted">Nothing on your calendar for the next 7 days.</p>
          ) : (
            <div className="rounded-xl border border-line bg-panel divide-y divide-line">
              {upcoming.map((e) => {
                const live = new Date(e.start).getTime() <= now;
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-20 shrink-0 text-xs text-muted">
                      <div className={live ? "text-accent font-medium" : ""}>{live ? "Now" : dayLabel(e.start)}</div>
                      <div>{fmtTime(e.start)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      {e.attendees.length > 0 && <div className="truncate text-xs text-muted">{e.attendees.slice(0, 4).join(", ")}{e.attendees.length > 4 ? ` +${e.attendees.length - 4}` : ""}</div>}
                    </div>
                    <button onClick={() => openEvent(e, false)} className="rounded-md px-2.5 py-1 text-xs text-ink-soft hover:bg-sunken">Open notes</button>
                    <button onClick={() => openEvent(e, true)} className="rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">● Start</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Notes */}
      <section className="mt-10">
        {rows === null ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-sunken animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
            <p className="text-4xl">🥣</p>
            <p className="mt-3 font-medium">{q ? "No notes match your search." : "No notes yet"}</p>
            {!q && <p className="mt-1 text-sm text-muted">Start a note before your next meeting and hit record.</p>}
          </div>
        ) : (
          [...groups.entries()].map(([day, items]) => (
            <div key={day} className="mb-7">
              <h2 className="text-xs uppercase tracking-wide text-muted mb-2">{day}</h2>
              <div className="space-y-1">
                {items.map((r) => (
                  <Link key={r.id} href={`/meetings/${r.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-sunken">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${r.enhanced ? "bg-accent-soft" : "bg-sunken"}`}>
                      {r.enhanced ? "✨" : "📝"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[15px] font-medium">{r.title || "Untitled note"}</div>
                      <div className="truncate text-xs text-muted">
                        {r.enhanced?.summary || r.notes.slice(0, 120) || (r.transcriptCount ? `${r.transcriptCount} transcript lines` : "Empty note")}
                      </div>
                    </div>
                    <div className="text-xs text-muted shrink-0">{fmtTime(r.scheduledAt ?? r.createdAt)}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
