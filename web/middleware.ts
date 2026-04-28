import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/partner"];

export function middleware(request: NextRequest) {
  const isProtected = protectedRoutes.some((route) => request.nextUrl.pathname.startsWith(route));
  if (!isProtected) {
    return NextResponse.next();
  }
  const session = request.cookies.get("cg_session_email")?.value;
  if (!session) {
    const url = new URL("/", request.url);
    url.searchParams.set("loginRequired", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/partner/:path*"]
};
