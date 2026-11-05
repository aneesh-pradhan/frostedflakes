import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Markdown } from "@/components/Markdown";
import { read } from "@/lib/db";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;
  const { meetings } = await read();
  const m = meetings.find((x) => x.shareId === shareId);
  if (!m) notFound();
  const e = m.enhanced;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line px-4 py-3 flex items-center gap-2 text-sm">
        <Logo size={18} /> <span className="font-serif font-semibold">FrostedFlakes</span>
        <span className="text-muted">· shared note</span>
      </header>
      <article className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">{m.title || "Untitled meeting"}</h1>
        <p className="mt-2 text-sm text-muted">
          {fmtDate(m.scheduledAt ?? m.createdAt)}
          {m.attendees.length > 0 && <> · {m.attendees.join(", ")}</>}
        </p>
        <div className="mt-8 text-[16px] leading-7">
          {e ? (
            <>
              {e.summary && <p className="mb-6 rounded-lg bg-sunken px-4 py-3 text-ink-soft">{e.summary}</p>}
              {e.sections.map((s, i) => (
                <section key={i} className="mb-5">
                  <h2 className="font-semibold mb-1">{s.heading}</h2>
                  <ul className="list-disc pl-5">{s.items.map((it, j) => <li key={j}>{it.text}</li>)}</ul>
                </section>
              ))}
              {e.action_items.length > 0 && (
                <section className="mb-5">
                  <h2 className="font-semibold mb-1">Action Items</h2>
                  <ul className="list-disc pl-5">
                    {e.action_items.map((a, i) => <li key={i}>{a.task}{a.owner && <span className="text-muted"> — {a.owner}</span>}</li>)}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <Markdown>{m.notes || "_No notes yet._"}</Markdown>
          )}
        </div>
      </article>
    </div>
  );
}
