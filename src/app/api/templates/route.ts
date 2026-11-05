import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { allTemplates, mutate } from "@/lib/db";
import type { Template } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await allTemplates());
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Template>;
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const t: Template = {
    id: nanoid(8),
    name: body.name.trim(),
    description: body.description?.trim() ?? "",
    sections: (body.sections ?? []).map((s) => s.trim()).filter(Boolean),
    instructions: body.instructions?.trim() ?? "",
    builtin: false,
  };
  await mutate((db) => void db.templates.push(t));
  return NextResponse.json(t);
}
