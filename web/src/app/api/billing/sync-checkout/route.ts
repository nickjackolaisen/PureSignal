import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, SESSION_COOKIE_NAME } from "../../../../lib/config";
import { fetchWithGatewayRetry, vercelPlatformApiMisconfigMessage } from "../../../../lib/platform-upstream";
import { createUserId, parseSessionToken } from "../../../../lib/session";

export const maxDuration = 60;

export async function POST(request: Request) {
  const cfgErr = vercelPlatformApiMisconfigMessage();
  if (cfgErr) {
    return NextResponse.json({ error: cfgErr }, { status: 503 });
  }

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
  const payload = JSON.stringify({ sessionId, userId });

  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 58_000);
  let upstream: Response;
  try {
    upstream = await fetchWithGatewayRetry(
      `${API_BASE_URL}/v1/billing/sync-checkout-session`,
      () => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal
      }),
    );
  } catch {
    clearTimeout(kill);
    return NextResponse.json({ error: "Could not reach checkout service." }, { status: 503 });
  } finally {
    clearTimeout(kill);
  }

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
    const fallback =
      typeof data.message === "string"
        ? data.message
        : raw
          ? `Platform HTTP ${upstream.status}`
          : upstream.status === 503 || upstream.status === 502
            ? `Platform returned ${upstream.status} (empty). Render may still be waking — try again in a moment.`
            : `Platform HTTP ${upstream.status} (empty body)`;
    data = { ...data, error: fallback };
  }

  return NextResponse.json(data, { status: upstream.status, headers: { "Cache-Control": "no-store" } });
}
