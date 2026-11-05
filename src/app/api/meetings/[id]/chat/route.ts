import { NextResponse } from "next/server";
import { meetingContext, streamChat } from "@/lib/ai";
import { getMeeting, read } from "@/lib/db";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  const m = await getMeeting(id);
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { settings } = await read();
  const context = `The user${settings.userName ? ` (${settings.userName})` : ""} is asking about this meeting:\n\n${meetingContext(m, settings.userName)}`;
  return new Response(streamChat(context, messages), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
