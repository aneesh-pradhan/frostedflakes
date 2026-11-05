import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { enhancedToMarkdown, transcriptToText } from "./format";
import type { EnhancedNotes, Meeting, Template } from "./types";

export const MODEL = process.env.FROSTEDFLAKES_MODEL || "claude-opus-5-5";

// Server-side refusal fallback: if a safety classifier declines, the API re-runs
// the request on Anthropic's recommended fallback model inside the same call.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

let _client: Anthropic | null = null;
export function client() {
  // Resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile.
  _client ??= new Anthropic();
  return _client;
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError)
    return "Claude credentials are missing or invalid. Set ANTHROPIC_API_KEY in .env.local and restart.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the Claude API. Try again in a moment.";
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}: ${err.message}`;
  if (err instanceof Error && /credentials|api key|apiKey/i.test(err.message))
    return "Claude credentials are missing. Set ANTHROPIC_API_KEY in .env.local and restart.";
  return err instanceof Error ? err.message : "Unknown error";
}

function logUsage(kind: string, msg: Anthropic.Beta.BetaMessage) {
  const u = msg.usage;
  console.info(
    `[claude] ${kind} model=${msg.model} stop=${msg.stop_reason} in=${u.input_tokens} out=${u.output_tokens} cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`,
  );
}

export function meetingContext(m: Meeting, userName: string, opts: { includeTranscript?: boolean } = {}) {
  const { includeTranscript = true } = opts;
  const when = m.scheduledAt ?? m.createdAt;
  const parts = [
    `<meeting id="${m.id}">`,
    `Title: ${m.title || "Untitled meeting"}`,
    `Date: ${new Date(when).toUTCString()}`,
    m.attendees.length ? `Attendees: ${m.attendees.join(", ")}` : "",
    `\n<my_notes>\n${m.notes.trim() || "(none)"}\n</my_notes>`,
    m.enhanced ? `\n<enhanced_notes>\n${enhancedToMarkdown(m.enhanced)}\n</enhanced_notes>` : "",
    includeTranscript
      ? `\n<transcript>\n${transcriptToText(m.transcript, userName) || "(no transcript)"}\n</transcript>`
      : "",
    `</meeting>`,
  ];
  return parts.filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Enhance notes
// ---------------------------------------------------------------------------

const ENHANCE_SYSTEM = `You are FrostedFlakes, an AI notepad for meetings. During the meeting the user jotted rough notes while FrostedFlakes transcribed the conversation. Your job is to "enhance" those notes: turn them into clean, well-organized meeting notes by combining the user's notes with details from the transcript.

Principles:
- The user's notes are the skeleton. They show what the user cared about. Every point in their notes must survive, rewritten for clarity but never dropped or contradicted. Emphasize what they emphasized.
- Use the transcript to fill in the substance: specifics, numbers, names, decisions, reasoning, and important points the user missed.
- Mark each item's source: "user" if it is primarily a cleaned-up version of something the user wrote, "ai" if it comes from the transcript alone. An item that expands a user note with transcript detail is still "user".
- Be concise and scannable. Each item is one bullet: a short sentence or fragment, no trailing period needed. No filler like "The team discussed...".
- Never invent facts. If the transcript is empty, work only from the notes. If something is unclear, leave it out rather than guess.
- Write in the user's voice ("we", names of people) not as an outside observer.
- action_items: concrete next steps with an owner if one was named or clearly implied (use "" if unknown). Do not repeat action items inside sections.
- summary: 1-2 sentences capturing the outcome of the meeting.
- title: a short, specific title (3-7 words) for the meeting.`;

const ENHANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "sections", "action_items"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "items"],
        properties: {
          heading: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "source"],
              properties: {
                text: { type: "string" },
                source: { type: "string", enum: ["user", "ai"] },
              },
            },
          },
        },
      },
    },
    action_items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task", "owner"],
        properties: { task: { type: "string" }, owner: { type: "string" } },
      },
    },
  },
} as const;

export interface EnhanceResult {
  title: string;
  summary: string;
  sections: EnhancedNotes["sections"];
  action_items: EnhancedNotes["action_items"];
}

export async function enhanceMeeting(m: Meeting, template: Template, userName: string): Promise<EnhanceResult> {
  const templateBlock = [
    `<template name="${template.name}">`,
    template.sections.length
      ? `Use exactly these section headings, in this order (omit a section only if nothing relevant was said): ${template.sections.join(" | ")}`
      : "",
    template.instructions,
    `</template>`,
  ]
    .filter(Boolean)
    .join("\n");

  const stream = client().beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: ENHANCE_SCHEMA } },
    system: ENHANCE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${meetingContext(m, userName)}\n\n${templateBlock}\n\nEnhance my notes for this meeting.${
          userName ? ` I am ${userName}; transcript lines labeled with my name are me.` : ""
        }`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  logUsage("enhance", msg);

  if (msg.stop_reason === "refusal") throw new Error("Claude declined to enhance these notes.");
  if (msg.stop_reason === "max_tokens") throw new Error("The enhanced notes were too long and got cut off.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return JSON.parse(text) as EnhanceResult;
}

// ---------------------------------------------------------------------------
// Chat (streaming)
// ---------------------------------------------------------------------------

const CHAT_SYSTEM = `You are FrostedFlakes, an AI notepad that has the user's meeting notes and transcripts. Answer questions and draft writing (follow-up emails, summaries, recaps, Slack messages) grounded strictly in the provided meeting material.

- Be direct and concise; use short markdown (bullets, bold) when it helps scanning.
- When drafting messages, write in the user's voice and keep them ready to send.
- If the meetings don't contain the answer, say so plainly instead of guessing.
- When answering across several meetings, mention which meeting (title and date) each point came from.`;

export function streamChat(context: string, history: Anthropic.Beta.BetaMessageParam[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client().beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          ...FALLBACK,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system: [
            { type: "text", text: CHAT_SYSTEM },
            // Meeting material is stable across turns -> cache it.
            { type: "text", text: context, cache_control: { type: "ephemeral" } },
          ],
          messages: history,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(enc.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        logUsage("chat", final);
        if (final.stop_reason === "refusal") {
          controller.enqueue(enc.encode("\n\n_Claude declined to answer this request._"));
        }
      } catch (err) {
        controller.enqueue(enc.encode(`\n\n⚠️ ${describeError(err)}`));
      } finally {
        controller.close();
      }
    },
  });
}
