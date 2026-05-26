import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../lib/config";
import { SESSION_COOKIE_NAME } from "../../../lib/config";
import { createUserId, parseSessionToken } from "../../../lib/session";

const FREE_ENTITLEMENT_FALLBACK = {
  planCode: "free",
  flags: {
    partnerRelay: false,
    advancedAnalytics: false,
    signedUpdates: false,
    cloudSync: false,
    desktopAdvanced: false,
    prioritySupport: false
  }
};

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

  let notice: string | undefined;
  if (!entRes) {
    notice = "Could not reach the platform API for entitlements. Check API_URL on Vercel.";
  } else if (!entRes.ok) {
    notice = `Platform returned ${entRes.status} when loading entitlements; showing free tier as fallback.`;
  }

  const entitlementsParsed = await safeJson(entRes);
  const entitlements =
    entitlementsParsed && typeof entitlementsParsed.planCode === "string"
      ? {
          planCode: entitlementsParsed.planCode,
          flags:
            entitlementsParsed.flags && typeof entitlementsParsed.flags === "object" && !Array.isArray(entitlementsParsed.flags)
              ? (entitlementsParsed.flags as Record<string, boolean>)
              : FREE_ENTITLEMENT_FALLBACK.flags
        }
      : FREE_ENTITLEMENT_FALLBACK;

  const platformStatus = (await safeJson(statusRes)) ?? { blocklistVersion: "unknown" };

  return NextResponse.json({
    user: { email: session.email, userId, provider: session.provider },
    entitlements,
    platformStatus,
    apiBaseUrl: API_BASE_URL,
    ...(notice ? { notice } : {})
  });
}
