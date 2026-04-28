import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_MODE } from "../../../../lib/config";
import { createSessionToken, getSessionCookieOptions } from "../../../../lib/session";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    email?: string;
    externalUserId?: string;
    provider?: string;
  };
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }

  const provider = AUTH_MODE === "external-header" ? "external-header" : String(payload.provider || "demo");
  const externalUserId = String(payload.externalUserId || email);
  const token = createSessionToken({ sub: externalUserId, email, provider });
  const sessionCookie = getSessionCookieOptions();
  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, token, sessionCookie.options);
  return NextResponse.json({ ok: true, email });
}
