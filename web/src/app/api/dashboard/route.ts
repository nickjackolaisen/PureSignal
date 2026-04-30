import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../lib/config";
import { SESSION_COOKIE_NAME } from "../../../lib/config";
import { createUserId, parseSessionToken } from "../../../lib/session";

async function safeJson(res: Response | null): Promise<Record<string, unknown> | null> {
  if (!res?.ok) return null;
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(sessionToken);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = createUserId(`${session.provider}:${session.sub}`);

  const [entRes, statusRes] = await Promise.all([
    fetch(`${API_BASE_URL}/v1/entitlements?userId=${encodeURIComponent(userId)}`).catch(() => null),
    fetch(`${API_BASE_URL}/v1/status`).catch(() => null)
  ]);

  const entitlements = (await safeJson(entRes)) ?? { planCode: "free", flags: {} };
  const platformStatus = (await safeJson(statusRes)) ?? { blocklistVersion: "unknown" };

  return NextResponse.json({
    user: { email: session.email, userId, provider: session.provider },
    entitlements,
    platformStatus
  });
}
