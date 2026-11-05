import type { CalendarEvent } from "./types";

/**
 * Minimal iCalendar (.ics) parser — enough to show upcoming meetings from a
 * Google Calendar / Outlook "secret address" feed. Handles line folding, UTC,
 * TZID and all-day dates, and expands simple DAILY/WEEKLY RRULEs.
 */

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function parseLine(line: string): Prop | null {
  const idx = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const [name, ...rawParams] = left.split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Offset (ms) of `tz` from UTC at instant `utcMs`. */
function tzOffset(utcMs: number, tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return asUtc - utcMs;
  } catch {
    return 0;
  }
}

function parseDate(p: Prop): { ms: number; allDay: boolean } | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (!m[4]) return { ms: new Date(+y, +mo - 1, +d).getTime(), allDay: true };
  if (z) return { ms: naive, allDay: false };
  const tz = p.params.TZID;
  if (!tz) return { ms: new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime(), allDay: false };
  const guess = naive - tzOffset(naive, tz);
  return { ms: naive - tzOffset(guess, tz), allDay: false };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY = 86_400_000;

/** Offset function for an event: its TZID, UTC ("Z"), or the server's local zone (floating). */
function offsetFor(p: Prop): (ms: number) => number {
  if (p.params.TZID) return (ms) => tzOffset(ms, p.params.TZID);
  if (/Z$/.test(p.value.trim())) return () => 0;
  return (ms) => -new Date(ms).getTimezoneOffset() * 60_000;
}

function expand(
  startMs: number,
  rrule: string,
  windowStart: number,
  windowEnd: number,
  exdates: Set<number>,
  offset: (ms: number) => number,
) {
  const r: Record<string, string> = {};
  for (const kv of rrule.split(";")) {
    const [k, v] = kv.split("=");
    if (k && v) r[k.toUpperCase()] = v;
  }
  const freq = r.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY") return [startMs];
  const interval = Math.max(1, Number(r.INTERVAL || 1));
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? parseDate({ name: "UNTIL", params: {}, value: r.UNTIL })?.ms ?? Infinity : Infinity;
  const byDay = r.BYDAY ? r.BYDAY.split(",").map((d) => DAY_CODES.indexOf(d.slice(-2))) : null;

  const out: number[] = [];
  let n = 0;
  // Weekday of the first occurrence, in the event's own timezone.
  const startDow = new Date(startMs + offset(startMs)).getUTCDay();
  const weekStart = startMs - startDow * DAY;
  for (let i = 0; i < 3000 && n < count; i++) {
    let candidates: number[];
    if (freq === "DAILY") {
      candidates = [startMs + i * interval * DAY];
    } else {
      const base = weekStart + i * interval * 7 * DAY;
      const days = byDay ?? [startDow];
      candidates = days
        .slice()
        .sort((a, b) => a - b)
        .map((d) => base + d * DAY)
        .filter((t) => t >= startMs);
    }
    for (const t of candidates) {
      // keep the event's wall-clock time stable across DST changes
      const fixed = t + offset(startMs) - offset(t);
      if (fixed > until || n >= count) return out;
      n++;
      if (fixed >= windowStart && fixed <= windowEnd && !exdates.has(fixed)) out.push(fixed);
    }
    if (candidates.length && candidates[0] > windowEnd) break;
  }
  return out;
}

export function parseIcs(text: string, windowStart: number, windowEnd: number): CalendarEvent[] {
  const lines = unfold(text).split("\n");
  const events: CalendarEvent[] = [];
  let cur: Prop[] | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = [];
    else if (line === "END:VEVENT" && cur) {
      const props = cur;
      cur = null;
      const get = (n: string) => props.find((p) => p.name === n);
      const dtstart = get("DTSTART");
      if (!dtstart || get("STATUS")?.value === "CANCELLED") continue;
      const start = parseDate(dtstart);
      if (!start || start.allDay) continue; // all-day events aren't meetings
      const endProp = get("DTEND");
      const end = endProp ? parseDate(endProp) : null;
      const duration = end ? end.ms - start.ms : 30 * 60_000;
      const attendees = props
        .filter((p) => p.name === "ATTENDEE")
        .map((p) => p.params.CN || p.value.replace(/^mailto:/i, ""))
        .filter(Boolean);
      const exdates = new Set(
        props.filter((p) => p.name === "EXDATE").flatMap((p) =>
          p.value.split(",").map((v) => parseDate({ ...p, value: v })?.ms ?? -1),
        ),
      );
      const rrule = get("RRULE")?.value;
      const starts = rrule ? expand(start.ms, rrule, windowStart, windowEnd, exdates, offsetFor(dtstart)) : [start.ms];
      const uid = get("UID")?.value || `${start.ms}`;
      for (const s of starts) {
        if (s + duration < windowStart || s > windowEnd) continue;
        events.push({
          id: `${uid}@${s}`,
          title: unescape(get("SUMMARY")?.value || "Untitled event"),
          start: new Date(s).toISOString(),
          end: new Date(s + duration).toISOString(),
          attendees,
          location: unescape(get("LOCATION")?.value || ""),
          description: unescape(get("DESCRIPTION")?.value || "").slice(0, 2000),
        });
      }
    } else if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }

  // A recurring event's overridden instance (RECURRENCE-ID) shares the UID; keep one per id.
  const seen = new Map<string, CalendarEvent>();
  for (const e of events) seen.set(e.id, e);
  return [...seen.values()].sort((a, b) => a.start.localeCompare(b.start));
}
