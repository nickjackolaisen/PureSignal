import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  cookies().delete("cg_session_email");
  return NextResponse.json({ ok: true });
}
