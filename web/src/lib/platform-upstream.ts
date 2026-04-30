/** Utilities for calling the self-hosted platform API (Render) from Vercel server routes. */

export function vercelPlatformApiMisconfigMessage(): string | null {
  if (process.env.VERCEL !== "1") return null;
  const u = (
    process.env.API_URL ||
    process.env.PLATFORM_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  )
    .trim()
    .toLowerCase();
  if (!u) {
    return "Missing API_URL or NEXT_PUBLIC_API_BASE_URL on Vercel. Set one to your Render API origin (https://….onrender.com).";
  }
  if (u.includes("localhost") || u.includes("127.0.0.1")) {
    return "API_URL points at localhost from Vercel, which will not reach your Render API. Set API_URL to your Render URL.";
  }
  return null;
}

const RETRY_STATUS = new Set([502, 503, 504]);

/**
 * Retry when Render (or its edge) returns gateway errors. Render often serves 503 with a
 * non-empty HTML/plain body while waking; we must not treat that as a final response.
 */
export async function fetchWithGatewayRetry(
  url: string,
  init: () => RequestInit,
  options: { attempts?: number; pauseMs?: number } = {}
): Promise<Response> {
  const attempts = options.attempts ?? 5;
  const pauseMs = options.pauseMs ?? 3500;
  let last: Response | undefined;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
    last = await fetch(url, init());
    if (last.ok) return last;
    if (!RETRY_STATUS.has(last.status)) return last;
    const isLast = i === attempts - 1;
    if (!isLast) {
      await last.clone().text().catch(() => {});
    }
  }
  return last as Response;
}
