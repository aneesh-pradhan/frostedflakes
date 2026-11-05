"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/components/api";
import { Chat } from "@/components/Chat";
import type { Folder } from "@/lib/types";

export default function AskPage() {
  return (
    <Suspense>
      <Ask />
    </Suspense>
  );
}

function Ask() {
  const search = useSearchParams();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState<string>(search.get("folder") ?? "");
  useEffect(() => void api<Folder[]>("/api/folders").then(setFolders).catch(() => {}), []);

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 pt-10 flex flex-col h-[calc(100vh-1px)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Ask FrostedFlakes</h1>
          <p className="mt-1 text-sm text-muted">Chat across every meeting you&apos;ve had — recall decisions, prep for the next call, spot patterns.</p>
        </div>
        <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="rounded-md border border-line bg-panel px-2 py-1 text-sm">
          <option value="">All meetings</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>📁 {f.name}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-h-0">
        <Chat
          key={folderId}
          endpoint="/api/chat"
          extraBody={{ folderId: folderId || null }}
          suggestions={[
            "What did I commit to this week?",
            "Prep me for my next meeting",
            "What are customers asking for most?",
            "List open action items across meetings",
            "Summarize this week in 5 bullets",
          ]}
          placeholder="Ask across your meetings…"
        />
      </div>
    </div>
  );
}
