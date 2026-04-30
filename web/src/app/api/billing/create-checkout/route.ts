import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, SESSION_COOKIE_NAME, SITE_URL } from "../../../../lib/config";
import { fetchWithGatewayRetry, vercelPlatformApiMisconfigMessage } from "../../../../lib/platform-upstream";
import { createUserId, parseSessionToken } from "../../../../lib/session";

/** Vercel: allow long enough for platform-api cold start (requires Pro+ for >10s). */
export const maxDuration = 60;

export async function POST(request: Request) {
  const cfgErr = vercelPlatformApiMisconfigMessage();
  if (cfgErr) {
    return NextResponse.json({ error: cfgErr }, { status: 503 });
  }

  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to continue to checkout." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planCode = typeof body.planCode === "string" ? body.planCode.trim() : "";
  const interval = typeof body.interval === "string" ? body.interval.trim() : "";

  if (!planCode || !interval) {
    return NextResponse.json({ error: "invalid_plan_or_interval" }, { status: 400 });
  }

  const userId = createUserId(`${session.provider}:${session.sub}`);

  const base = SITE_URL.replace(/\/$/, "");
  const successUrlDefault = `${base}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrlDefault = `${base}/pricing`;

  let successUrl = typeof body.successUrl === "string" && body.successUrl.trim().startsWith("http") ? body.successUrl : successUrlDefault;
  let cancelUrl = typeof body.cancelUrl === "string" && body.cancelUrl.trim().startsWith("http") ? body.cancelUrl : cancelUrlDefault;

  const controller = new AbortController();
  const kill = setTimeout(() => controller.abort(), 58_000);
  const payload = JSON.stringify({
    userId,
    planCode,
    interval,
    successUrl,
    cancelUrl
  });
  let upstream: Response;
  try {
    upstream = await fetchWithGatewayRetry(
      `${API_BASE_URL}/v1/billing/create-checkout`,
      () => ({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal
      }),
    );
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        error: timedOut
          ? "Checkout service took too long to respond. Try again in a few seconds, or upgrade hosting so the API stays warm."
          : "Could not reach checkout service."
      },
      { status: 503 }
    );
  } finally {
    clearTimeout(kill);
  }

  const raw = await upstream.text();
  let data: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      data = {
        error: `Platform returned ${upstream.status} (not JSON). First bytes: ${raw.slice(0, 280).replace(/\s+/g, " ")}`
      };
    }
  }

  if (!upstream.ok && typeof data.error !== "string") {
    const fallback =
      typeof data.message === "string"
        ? data.message
        : raw
          ? `Platform HTTP ${upstream.status}`
          : upstream.status === 503 || upstream.status === 502
            ? `Platform returned ${upstream.status} (empty). Render may be waking from sleep — try again in ~30 seconds, use /api/platform/warm first, or keep the API always-on.`
            : `Platform HTTP ${upstream.status} (empty body)`;
    data = { ...data, error: fallback };
  }

  return NextResponse.json(data, {
    status: upstream.status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
