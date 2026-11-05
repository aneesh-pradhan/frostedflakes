import type { EnhancedNotes, Meeting, TranscriptSegment } from "./types";

export function fmtTimestamp(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function transcriptToText(segments: TranscriptSegment[], userName = "Me") {
  return segments
    .map((s) => `[${fmtTimestamp(s.t)}] ${s.speaker === "me" ? userName || "Me" : "Them"}: ${s.text}`)
    .join("\n");
}

export function enhancedToMarkdown(e: EnhancedNotes) {
  const out: string[] = [];
  if (e.summary) out.push(e.summary, "");
  for (const s of e.sections) {
    out.push(`### ${s.heading}`);
    for (const i of s.items) out.push(`- ${i.text}`);
    out.push("");
  }
  if (e.action_items.length) {
    out.push("### Action Items");
    for (const a of e.action_items) out.push(`- [ ] ${a.task}${a.owner ? ` — ${a.owner}` : ""}`);
  }
  return out.join("\n").trim();
}

export function meetingToMarkdown(m: Meeting) {
  const head = [`# ${m.title || "Untitled meeting"}`, fmtDate(m.scheduledAt ?? m.createdAt)];
  if (m.attendees.length) head.push(`Attendees: ${m.attendees.join(", ")}`);
  const body = m.enhanced ? enhancedToMarkdown(m.enhanced) : m.notes;
  return `${head.join("\n")}\n\n${body}`.trim();
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(today)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
