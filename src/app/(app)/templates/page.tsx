"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import type { Template } from "@/lib/types";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", sections: "", instructions: "" });
  const [error, setError] = useState<string | null>(null);

  const load = () => api<Template[]>("/api/templates").then(setTemplates);
  useEffect(() => void load(), []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/templates", { method: "POST", json: { ...form, sections: form.sections.split("\n") } });
      setForm({ name: "", description: "", sections: "", instructions: "" });
      setOpen(false);
      setError(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-muted">Templates shape how FrostedFlakes structures enhanced notes. Pick one per meeting, or switch to regenerate.</p>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-paper">+ New template</button>
      </div>

      {open && (
        <form onSubmit={create} className="mt-6 space-y-3 rounded-xl border border-line bg-panel p-5">
          <Field label="Name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="Board meeting" />
          </Field>
          <Field label="Description">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} placeholder="Quarterly board updates" />
          </Field>
          <Field label="Sections (one per line — leave empty to let AI decide)">
            <textarea rows={4} value={form.sections} onChange={(e) => setForm({ ...form, sections: e.target.value })} className={input} placeholder={"Metrics\nKey Risks\nBoard Asks\nDecisions"} />
          </Field>
          <Field label="Instructions for the AI">
            <textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} className={input} placeholder="Quote exact numbers. Note which board member raised each concern." />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">Create</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-muted">Cancel</button>
          </div>
        </form>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium">{t.name}</h3>
              {t.builtin ? (
                <span className="text-[11px] text-muted">Built-in</span>
              ) : (
                <button
                  onClick={async () => {
                    await api(`/api/templates/${t.id}`, { method: "DELETE" });
                    load();
                  }}
                  className="text-xs text-muted hover:text-danger"
                >
                  Delete
                </button>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted">{t.description}</p>
            {t.sections.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {t.sections.map((s) => (
                  <span key={s} className="rounded-full bg-sunken px-2 py-0.5 text-xs text-ink-soft">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}
