import { NextResponse } from "next/server";
import { read } from "@/lib/db";
import { parseIcs } from "@/lib/ics";

export async function GET() {
  const { settings } = await read();
  if (!settings.icsUrl) return NextResponse.json({ connected: false, events: [] });
  try {
    const url = settings.icsUrl.replace(/^webcal:\/\//i, "https://");
    if (!/^https?:\/\//i.test(url)) throw new Error("Calendar URL must start with https:// or webcal://");
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
    const now = Date.now();
    const events = parseIcs(await res.text(), now - 12 * 3600_000, now + 7 * 86_400_000);
    return NextResponse.json({ connected: true, events });
  } catch (err) {
    return NextResponse.json({ connected: true, events: [], error: (err as Error).message });
  }
}
