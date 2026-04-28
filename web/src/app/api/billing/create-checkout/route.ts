import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL, SESSION_COOKIE_NAME, SITE_URL } from "../../../../lib/config";
import { createUserId, parseSessionToken } from "../../../../lib/session";

const PLANS = new Set(["ext_pro", "desktop_pro", "bundle_pro"]);
const INTERVALS = new Set(["monthly", "annual"]);

export async function POST(request: Request) {
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

  const planCode = body.planCode;
  const interval = body.interval;

  if (typeof planCode !== "string" || !PLANS.has(planCode)) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }
  if (typeof interval !== "string" || !INTERVALS.has(interval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  const userId = createUserId(`${session.provider}:${session.sub}`);

  const base = SITE_URL.replace(/\/$/, "");
  const successUrlDefault = `${base}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrlDefault = `${base}/pricing`;

  let successUrl = typeof body.successUrl === "string" && body.successUrl.trim().startsWith("http") ? body.successUrl : successUrlDefault;
  let cancelUrl = typeof body.cancelUrl === "string" && body.cancelUrl.trim().startsWith("http") ? body.cancelUrl : cancelUrlDefault;

  const upstream = await fetch(`${API_BASE_URL}/v1/billing/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      planCode,
      interval,
      successUrl,
      cancelUrl
    })
  });

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(data, {
    status: upstream.status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
