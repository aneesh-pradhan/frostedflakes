import { NextResponse } from "next/server";
import { describeError, enhanceMeeting } from "@/lib/ai";
import { getMeeting, getTemplate, mutate, read } from "@/lib/db";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { templateId?: string };
  const m = await getMeeting(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!m.notes.trim() && m.transcript.length === 0)
    return NextResponse.json({ error: "Write some notes or record the meeting first." }, { status: 400 });

  const templateId = body.templateId ?? m.templateId;
  const template = await getTemplate(templateId);
  const { settings } = await read();
  try {
    const r = await enhanceMeeting(m, template, settings.userName);
    const updated = await mutate((db) => {
      const x = db.meetings.find((y) => y.id === id)!;
      x.templateId = template.id;
      x.enhanced = {
        summary: r.summary,
        sections: r.sections,
        action_items: r.action_items,
        templateId: template.id,
        generatedAt: new Date().toISOString(),
      };
      if (!x.title.trim()) x.title = r.title;
      x.updatedAt = new Date().toISOString();
      return x;
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 502 });
  }
}
