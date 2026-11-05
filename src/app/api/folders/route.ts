import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { mutate, read } from "@/lib/db";

export async function GET() {
  const db = await read();
  const counts = Object.fromEntries(db.folders.map((f) => [f.id, db.meetings.filter((m) => m.folderId === f.id).length]));
  return NextResponse.json(db.folders.map((f) => ({ ...f, count: counts[f.id] ?? 0 })));
}

export async function POST(req: Request) {
  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const folder = { id: nanoid(8), name: name.trim(), createdAt: new Date().toISOString() };
  await mutate((db) => void db.folders.push(folder));
  return NextResponse.json(folder);
}
