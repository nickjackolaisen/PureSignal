import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../../lib/config";

export const dynamic = "force-dynamic";

/** Wake platform-api (e.g. after Render idle spin-down). Best-effort; no auth. */
export async function GET() {
  const base = API_BASE_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${base}/health`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    clearTimeout(kill);
    if (!res.ok) {
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    clearTimeout(kill);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
