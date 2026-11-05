import { meetingContext, streamChat } from "@/lib/ai";
import { read } from "@/lib/db";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 300;

// Rough budget so the cross-meeting context stays well inside the context window.
const CHAR_BUDGET = 2_000_000;

export async function POST(req: Request) {
  const { messages, folderId } = (await req.json()) as { messages: ChatMessage[]; folderId?: string | null };
  const { meetings, settings, folders } = await read();
  const pool = (folderId ? meetings.filter((m) => m.folderId === folderId) : meetings)
    .slice()
    .sort((a, b) => (b.scheduledAt ?? b.createdAt).localeCompare(a.scheduledAt ?? a.createdAt));

  // Newest meetings get full transcripts; once the budget is used up, older ones
  // are included as notes only, and the model is told so.
  let used = 0;
  let notesOnly = 0;
  const blocks = pool.map((m) => {
    const full = meetingContext(m, settings.userName);
    if (used + full.length <= CHAR_BUDGET) {
      used += full.length;
      return full;
    }
    notesOnly++;
    const slim = meetingContext(m, settings.userName, { includeTranscript: false });
    used += slim.length;
    return slim;
  });

  const scope = folderId ? `the folder "${folders.find((f) => f.id === folderId)?.name ?? "?"}"` : "all of their meetings";
  const context = [
    // Date only (no time): this text sits in the cached system block, so anything
    // that changes per request would break the prompt cache on every turn.
    `Today is ${new Date().toISOString().slice(0, 10)}. The user${settings.userName ? ` (${settings.userName})` : ""} is asking across ${scope}: ${pool.length} meeting(s), newest first.`,
    notesOnly ? `Note: the ${notesOnly} oldest meeting(s) are included without transcripts to fit the context.` : "",
    blocks.join("\n\n") || "(The user has no meetings yet.)",
  ].filter(Boolean).join("\n\n");

  return new Response(streamChat(context, messages), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
