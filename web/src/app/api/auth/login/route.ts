import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { email?: string };
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  cookies().set("cg_session_email", email, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return NextResponse.json({ ok: true, email });
}
