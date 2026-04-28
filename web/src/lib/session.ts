import crypto from "node:crypto";
import { AUTH_SESSION_SECRET, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "./config";

type SessionPayload = {
  sub: string;
  email: string;
  provider: string;
  iat: number;
  exp: number;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto.createHmac("sha256", AUTH_SESSION_SECRET).update(value).digest("base64url");
}

export function createUserId(subject: string) {
  return `user_${crypto.createHash("sha256").update(subject).digest("hex").slice(0, 24)}`;
}

export function createSessionToken(payload: { sub: string; email: string; provider: string }) {
  const now = Math.floor(Date.now() / 1000);
  const session: SessionPayload = {
    sub: payload.sub,
    email: payload.email,
    provider: payload.provider,
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };
  const body = encodeBase64Url(JSON.stringify(session));
  return `${body}.${sign(body)}`;
}

export function parseSessionToken(token: string | undefined) {
  if (!token || !token.includes(".")) {
    return null;
  }
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }
  if (sign(body) !== signature) {
    return null;
  }
  const payload = JSON.parse(decodeBase64Url(body)) as SessionPayload;
  if (!payload?.sub || !payload?.email || !payload?.provider) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    return null;
  }
  return payload;
}

export function getSessionCookieOptions() {
  const isSecure = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: isSecure,
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    }
  };
}
