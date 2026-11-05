"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "./Logo";
import { api, notifyChanged } from "./api";
import type { Folder } from "@/lib/types";

type FolderRow = Folder & { count: number };

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [q, setQ] = useState(search.get("q") ?? "");

  const load = useCallback(() => api<FolderRow[]>("/api/folders").then(setFolders).catch(() => {}), []);
  useEffect(() => {
    load();
    window.addEventListener("ff:changed", load);
    return () => window.removeEventListener("ff:changed", load);
  }, [load]);

  async function newNote() {
    const m = await api<{ id: string }>("/api/meetings", { method: "POST", json: {} });
    notifyChanged();
    router.push(`/meetings/${m.id}?record=1`);
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setAdding(false);
    await api("/api/folders", { method: "POST", json: { name } });
    setName("");
    setAdding(false);
    load();
  }

  const activeFolder = search.get("folder");
  const item = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition ${
      active ? "bg-sunken text-ink font-medium" : "text-ink-soft hover:bg-sunken/70"
    }`;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-line bg-panel/60 h-screen sticky top-0">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Logo />
        <span className="font-serif text-lg font-semibold tracking-tight">FrostedFlakes</span>
      </div>

      <div className="px-3">
        <button
          onClick={newNote}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-ink text-paper px-3 py-2 text-sm font-medium hover:opacity-90"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-accent" /> New note
        </button>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
        </form>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 space-y-0.5">
        <Link href="/" className={item(pathname === "/" && !activeFolder && !search.get("q"))}>🏠 Home</Link>
        <Link href="/ask" className={item(pathname === "/ask")}>✨ Ask FrostedFlakes</Link>
        <Link href="/templates" className={item(pathname === "/templates")}>📋 Templates</Link>
        <Link href="/settings" className={item(pathname === "/settings")}>⚙️ Settings</Link>

        <div className="pt-5 pb-1 px-2.5 flex items-center justify-between text-xs uppercase tracking-wide text-muted">
          Folders
          <button onClick={() => setAdding(true)} className="text-base leading-none hover:text-ink" title="New folder">+</button>
        </div>
        {folders.map((f) => (
          <Link key={f.id} href={`/?folder=${f.id}`} className={item(activeFolder === f.id)}>
            <span>📁</span>
            <span className="flex-1 truncate">{f.name}</span>
            <span className="text-xs text-muted">{f.count}</span>
          </Link>
        ))}
        {adding && (
          <form onSubmit={addFolder} className="px-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={addFolder}
              placeholder="Folder name"
              className="w-full rounded-md border border-accent bg-paper px-2 py-1 text-sm outline-none"
            />
          </form>
        )}
        {!folders.length && !adding && <p className="px-2.5 text-xs text-muted">No folders yet.</p>}
      </nav>
      <p className="px-4 py-3 text-[11px] text-muted">No meeting bots. Just you, your notes, and the transcript.</p>
    </aside>
  );
}
