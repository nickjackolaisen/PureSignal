import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, SESSION_COOKIE_NAME } from "../../../../lib/config";
import { createUserId, parseSessionToken } from "../../../../lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "invalid_session_id" }, { status: 400 });
  }

  const userId = createUserId(`${session.provider}:${session.sub}`);

  const upstream = await fetch(`${API_BASE_URL}/v1/billing/sync-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, userId })
  });

  const raw = await upstream.text();
  let data: Record<string, unknown> = {};
  if (raw) {
    try {
      const j = JSON.parse(raw) as unknown;
      if (j && typeof j === "object" && !Array.isArray(j)) data = j as Record<string, unknown>;
    } catch {
      data = { error: `Platform ${upstream.status}: ${raw.slice(0, 200)}` };
    }
  }
  if (!upstream.ok && typeof data.error !== "string") {
    data = { ...data, error: `Platform HTTP ${upstream.status}` };
  }

  return NextResponse.json(data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
}
