"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SyncState = "syncing" | "ok" | "error";

export function SuccessClient({ sessionId }: { sessionId: string | null }) {
  const [state, setState] = useState<SyncState>(() => (sessionId ? "syncing" : "error"));
  const [error, setError] = useState<string | null>(() =>
    sessionId
      ? null
      : "Missing checkout session in the URL. Open the dashboard in a minute or return from Stripe’s receipt link."
  );

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const r = await fetch("/api/billing/sync-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId })
        });
        const json = (await r.json().catch(() => ({}))) as { error?: string; ok?: boolean };
        if (cancelled) return;
        if (!r.ok) {
          setState("error");
          setError(typeof json.error === "string" ? json.error : `Could not sync (${r.status})`);
          return;
        }
        setState("ok");
        setError(null);
      } catch {
        if (!cancelled) {
          setState("error");
          setError("Network error while syncing your subscription.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <section className="successPanel">
      <p className="brandEyebrow brandEyebrow--center">
        PureSignal
      </p>
      <h2>You&apos;re nearly there</h2>
      {state === "syncing" && (
        <p className="muted">Linking your Stripe payment to your account — one moment…</p>
      )}
      {state === "ok" && (
        <p className="muted">All set. Your subscription is linked to this login.</p>
      )}
      {state === "error" && error && <p className="muted">{error}</p>}
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/dashboard">Go to Dashboard</Link>
      </p>
      <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
        Questions? Visit <Link href="/support">support</Link>.
      </p>
    </section>
  );
}
