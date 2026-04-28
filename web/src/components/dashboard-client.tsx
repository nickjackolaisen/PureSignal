"use client";

import { useEffect, useState } from "react";

type DashboardState = {
  user: { email: string; userId: string; provider?: string };
  entitlements: { planCode: string; flags: Record<string, boolean> };
  platformStatus: { blocklistVersion?: string; publishedAt?: string };
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardState | null>(null);
  const [error, setError] = useState("");

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

  if (error) {
    return <p className="muted">{error}</p>;
  }
  if (!data) {
    return <p className="muted">Loading dashboard...</p>;
  }

  return (
    <>
      <p>
        Signed in as <strong>{data.user.email}</strong>
      </p>
      <p>Auth provider: {data.user.provider || "unknown"}</p>
      <p>Plan: {data.entitlements.planCode}</p>
      <p>Blocklist version: {data.platformStatus.blocklistVersion || "unknown"}</p>
      <pre>{JSON.stringify(data.entitlements.flags, null, 2)}</pre>
      <button onClick={logout}>Logout</button>
    </>
  );
}
