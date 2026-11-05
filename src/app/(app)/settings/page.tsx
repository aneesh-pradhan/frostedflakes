"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import type { Settings } from "@/lib/types";

type S = Settings & { hasApiKey: boolean };

export default function SettingsPage() {
  const [s, setS] = useState<S | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => void api<S>("/api/settings").then(setS), []);
  if (!s) return <div className="p-10 text-muted">Loading…</div>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/settings", { method: "PUT", json: { userName: s!.userName, icsUrl: s!.icsUrl } });
    setStatus("Saved");
    setTimeout(() => setStatus(null), 1500);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-8 py-10">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>

      <form onSubmit={save} className="mt-8 space-y-6">
        <section className="rounded-xl border border-line bg-panel p-5 space-y-4">
          <h2 className="font-medium">You</h2>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Your name — used to label your lines in transcripts and to write in your voice</span>
            <input value={s.userName} onChange={(e) => setS({ ...s, userName: e.target.value })} className={input} placeholder="Alex Rivera" />
          </label>
        </section>

        <section className="rounded-xl border border-line bg-panel p-5 space-y-3">
          <h2 className="font-medium">Calendar</h2>
          <p className="text-sm text-muted">
            Paste your calendar&apos;s private iCal address to see upcoming meetings on Home and start notes with title and attendees filled in.
          </p>
          <ul className="text-xs text-muted list-disc pl-5 space-y-0.5">
            <li>Google Calendar: Settings → your calendar → Integrate calendar → <em>Secret address in iCal format</em></li>
            <li>Outlook: Settings → Calendar → Shared calendars → Publish a calendar → ICS link</li>
            <li>Apple iCloud: Share calendar → Public calendar → copy the webcal:// link</li>
          </ul>
          <input value={s.icsUrl} onChange={(e) => setS({ ...s, icsUrl: e.target.value })} className={input} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" />
        </section>

        <section className="rounded-xl border border-line bg-panel p-5 space-y-2">
          <h2 className="font-medium">AI</h2>
          <p className="text-sm">
            Claude API key:{" "}
            {s.hasApiKey ? <span className="text-green-600">detected ✓</span> : <span className="text-danger">not set in environment</span>}
          </p>
          {!s.hasApiKey && (
            <p className="text-xs text-muted">
              Add <code className="rounded bg-sunken px-1">ANTHROPIC_API_KEY=…</code> to <code className="rounded bg-sunken px-1">.env.local</code> and restart the server.
              (If you&apos;ve run <code className="rounded bg-sunken px-1">ant auth login</code>, that profile is used automatically.)
            </p>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">Save settings</button>
          {status && <span className="text-sm text-muted">{status}</span>}
        </div>
      </form>
    </div>
  );
}

const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
