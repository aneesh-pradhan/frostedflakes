import { NextResponse } from "next/server";
import { mutate } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { name } = (await req.json()) as { name: string };
  await mutate((db) => {
    const f = db.folders.find((x) => x.id === id);
    if (f && name?.trim()) f.name = name.trim();
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  await mutate((db) => {
    db.folders = db.folders.filter((f) => f.id !== id);
    for (const m of db.meetings) if (m.folderId === id) m.folderId = null;
  });
  return NextResponse.json({ ok: true });
}
