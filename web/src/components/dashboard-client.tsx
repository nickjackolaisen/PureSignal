"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardState = {
  user: { email: string; userId: string; provider?: string };
  entitlements: { planCode: string; flags: Record<string, boolean> };
  platformStatus: { blocklistVersion?: string; publishedAt?: string };
  apiBaseUrl?: string;
  notice?: string;
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load dashboard");
        }
        return response.json();
      })
      .then(setData)
      .catch(() => setError("Could not load live dashboard data."));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  async function copyToClipboard(text: string, fieldName: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }

  if (error) {
    return <p className="muted">{error}</p>;
  }
  if (!data) {
    return <p className="muted">Loading dashboard...</p>;
  }

  const isFree = data.entitlements.planCode === "free";

  return (
    <>
      {data.notice ? <p className="muted">{data.notice}</p> : null}
      <p>
        Signed in as <strong>{data.user.email}</strong>
      </p>
      <p>Auth provider: {data.user.provider || "unknown"}</p>
      <p>
        Plan: <strong>{data.entitlements.planCode}</strong>
        {isFree && (
          <>
            {" "}
            — <Link href="/pricing">Upgrade to Pro</Link>
          </>
        )}
      </p>
      <p>Blocklist version: {data.platformStatus.blocklistVersion || "unknown"}</p>

      <section style={{ marginTop: "1.5rem", padding: "1rem", background: "#1e293b", borderRadius: "8px" }}>
        <h4 style={{ margin: "0 0 0.75rem 0" }}>Extension Setup</h4>
        <p className="muted" style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
          Paste these values into the PureSignal extension Options page to sync your entitlements.
        </p>

        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#94a3b8" }}>API Base URL</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code
              style={{
                flex: 1,
                padding: "0.5rem",
                background: "#0f172a",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                wordBreak: "break-all"
              }}
            >
              {data.apiBaseUrl || "Not configured"}
            </code>
            {data.apiBaseUrl && (
              <button
                onClick={() => copyToClipboard(data.apiBaseUrl!, "apiBaseUrl")}
                style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
              >
                {copiedField === "apiBaseUrl" ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
        </div>

        <div>
          <label style={{ fontSize: "0.75rem", color: "#94a3b8" }}>User ID</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code
              style={{
                flex: 1,
                padding: "0.5rem",
                background: "#0f172a",
                borderRadius: "4px",
                fontSize: "0.8125rem",
                wordBreak: "break-all"
              }}
            >
              {data.user.userId}
            </code>
            <button
              onClick={() => copyToClipboard(data.user.userId, "userId")}
              style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}
            >
              {copiedField === "userId" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", color: "#94a3b8" }}>Feature flags</summary>
        <pre style={{ fontSize: "0.75rem" }}>{JSON.stringify(data.entitlements.flags, null, 2)}</pre>
      </details>

      <button onClick={logout} style={{ marginTop: "1rem" }}>
        Logout
      </button>
    </>
  );
}
