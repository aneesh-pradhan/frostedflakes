import { NextResponse } from "next/server";
import { mutate, read } from "@/lib/db";
import type { Settings } from "@/lib/types";

export async function GET() {
  const { settings } = await read();
  return NextResponse.json({ ...settings, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Settings>;
  const settings = await mutate((db) => {
    if (typeof body.userName === "string") db.settings.userName = body.userName.trim();
    if (typeof body.icsUrl === "string") db.settings.icsUrl = body.icsUrl.trim();
    return db.settings;
  });
  return NextResponse.json(settings);
}
