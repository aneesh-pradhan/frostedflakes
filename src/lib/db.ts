import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { BUILTIN_TEMPLATES } from "./templates";
import type { DB, Meeting } from "./types";

/**
 * Tiny JSON-file database. Everything lives in ./data/db.json so the MVP needs
 * no external services. Writes are serialized through a promise chain.
 */
const DATA_DIR = process.env.FROSTEDFLAKES_DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const empty = (): DB => ({
  meetings: [],
  folders: [],
  templates: [],
  settings: { userName: "", icsUrl: "" },
});

let cache: DB | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<DB> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    cache = { ...empty(), ...(JSON.parse(raw) as Partial<DB>) } as DB;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    cache = empty();
  }
  return cache;
}

async function persist(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, DB_FILE);
}

export async function read(): Promise<DB> {
  return load();
}

/** Run a mutation and persist it. Mutations are applied one at a time. */
export async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  let result!: T;
  const next = writeChain.then(async () => {
    const db = await load();
    result = await fn(db);
    await persist(db);
  });
  writeChain = next.catch(() => {});
  await next;
  return result;
}

export async function allTemplates() {
  const db = await read();
  return [...BUILTIN_TEMPLATES, ...db.templates];
}

export async function getTemplate(id: string) {
  const all = await allTemplates();
  return all.find((t) => t.id === id) ?? BUILTIN_TEMPLATES[0];
}

export async function getMeeting(id: string) {
  const db = await read();
  return db.meetings.find((m) => m.id === id) ?? null;
}

export function newMeeting(partial: Partial<Meeting> = {}): Meeting {
  const now = new Date().toISOString();
  return {
    id: nanoid(10),
    title: "",
    createdAt: now,
    updatedAt: now,
    attendees: [],
    folderId: null,
    templateId: "auto",
    notes: "",
    transcript: [],
    recordedMs: 0,
    enhanced: null,
    chat: [],
    shareId: null,
    ...partial,
  };
}
