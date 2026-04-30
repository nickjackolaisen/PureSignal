/**
 * Platform API (Render). Prefer non-public env on the server so Vercel server routes
 * still work if only API_URL is set; the browser needs NEXT_PUBLIC_API_BASE_URL for any client-side calls.
 */
function firstDefinedTrimmedUrl(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim()) {
      return v.replace(/\/+$/, "").trim();
    }
  }
  return "";
}

export const API_BASE_URL =
  firstDefinedTrimmedUrl("API_URL", "PLATFORM_API_URL", "NEXT_PUBLIC_API_BASE_URL") || "http://localhost:8787";
export const DEMO_AUTH_EMAIL = process.env.NEXT_PUBLIC_DEMO_AUTH_EMAIL || "demo@puresignal.io";
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ps_session";
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7);
export const AUTH_MODE = process.env.AUTH_MODE || "demo";
export const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "local-dev-auth-secret";

/** Canonical site URL for Stripe success/cancel redirects */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://puresignal.io";
