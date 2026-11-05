import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await mutate((db) => {
    db.templates = db.templates.filter((t) => t.id !== id);
    for (const m of db.meetings) if (m.templateId === id) m.templateId = "auto";
  });
  return NextResponse.json({ ok: true });
}
