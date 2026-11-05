import { NextResponse } from "next/server";
import { mutate, newMeeting, read } from "@/lib/db";
import type { Meeting } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder");
  const q = url.searchParams.get("q")?.toLowerCase().trim();
  const db = await read();
  let meetings = db.meetings;
  if (folder) meetings = meetings.filter((m) => m.folderId === folder);
  if (q) {
    meetings = meetings.filter((m) =>
      [m.title, m.notes, m.attendees.join(" "), m.transcript.map((s) => s.text).join(" "),
        m.enhanced ? JSON.stringify(m.enhanced) : ""]
        .join("\n").toLowerCase().includes(q),
    );
  }
  // List view doesn't need the heavy fields.
  const list = meetings
    .map(({ transcript, chat, ...rest }) => ({ ...rest, transcriptCount: transcript.length, chatCount: chat.length }))
    .sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Meeting>;
  const db0 = await read();
  // Opening the same calendar event twice reuses its note.
  if (body.calendarEventId) {
    const existing = db0.meetings.find((m) => m.calendarEventId === body.calendarEventId);
    if (existing) return NextResponse.json(existing);
  }
  const m = newMeeting({
    title: body.title ?? "",
    attendees: body.attendees ?? [],
    folderId: body.folderId ?? null,
    templateId: body.templateId ?? "auto",
    scheduledAt: body.scheduledAt,
    calendarEventId: body.calendarEventId,
    notes: body.notes ?? "",
  });
  await mutate((db) => void db.meetings.push(m));
  return NextResponse.json(m);
}
