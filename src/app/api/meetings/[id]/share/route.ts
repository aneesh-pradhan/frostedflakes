import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { mutate } from "@/lib/db";

/** POST toggles a public read-only link: { enabled: boolean } */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { enabled } = (await req.json()) as { enabled: boolean };
  const m = await mutate((db) => {
    const x = db.meetings.find((y) => y.id === id);
    if (!x) return null;
    x.shareId = enabled ? x.shareId ?? nanoid(16) : null;
    return x;
  });
  return m ? NextResponse.json({ shareId: m.shareId }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
