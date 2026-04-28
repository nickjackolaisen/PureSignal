import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../../lib/config";

export async function GET() {
  const email = cookies().get("cg_session_email")?.value;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Map email to deterministic dev user id until full auth provider is integrated.
  const userId = `user_${Buffer.from(email).toString("hex").slice(0, 12)}`;

  const [entRes, statusRes] = await Promise.all([
    fetch(`${API_BASE_URL}/v1/entitlements?userId=${encodeURIComponent(userId)}`).catch(() => null),
    fetch(`${API_BASE_URL}/v1/status`).catch(() => null)
  ]);

  const entitlements = entRes && entRes.ok ? await entRes.json() : { planCode: "free", flags: {} };
  const platformStatus = statusRes && statusRes.ok ? await statusRes.json() : { blocklistVersion: "unknown" };

  return NextResponse.json({
    user: { email, userId },
    entitlements,
    platformStatus
  });
}
