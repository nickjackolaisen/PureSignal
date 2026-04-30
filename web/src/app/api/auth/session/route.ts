import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/config";
import { parseSessionToken } from "../../../../lib/session";

/** Cookie-only session check (no platform-api). Use on pricing and similar pages. */
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);
  if (!session) {
    return NextResponse.json({ signedIn: false as const }, { status: 401 });
  }
  return NextResponse.json({
    signedIn: true as const,
    email: session.email,
    provider: session.provider
  });
}
