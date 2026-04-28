export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8787";
export const DEMO_AUTH_EMAIL = process.env.NEXT_PUBLIC_DEMO_AUTH_EMAIL || "demo@puresignal.io";
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ps_session";
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7);
export const AUTH_MODE = process.env.AUTH_MODE || "demo";
export const AUTH_SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "local-dev-auth-secret";

/** Canonical site URL for Stripe success/cancel redirects */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://puresignal.io";
