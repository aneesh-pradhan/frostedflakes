import { NextResponse } from "next/server";
import { getMeeting, mutate } from "@/lib/db";
import type { Meeting } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE: (keyof Meeting)[] = [
  "title", "attendees", "folderId", "templateId", "notes", "transcript", "recordedMs", "enhanced", "chat",
];

export async function GET(_req: Request, { params }: Ctx) {
  const m = await getMeeting((await params).id);
  return m ? NextResponse.json(m) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json()) as Partial<Meeting>;
  const updated = await mutate((db) => {
    const m = db.meetings.find((x) => x.id === id);
    if (!m) return null;
    for (const k of EDITABLE) if (k in body) (m as unknown as Record<string, unknown>)[k] = body[k];
    m.updatedAt = new Date().toISOString();
    return m;
  });
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await mutate((db) => void (db.meetings = db.meetings.filter((m) => m.id !== id)));
  return NextResponse.json({ ok: true });
}
