"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

type Billing = "month" | "year";

type PlanCodeApi = "ext_pro" | "desktop_pro" | "bundle_pro";

type Plan = {
  name: string;
  planCode: PlanCodeApi;
  monthly: number;
  yearly: number;
  tagline: string;
  popular?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Chrome Pro",
    planCode: "ext_pro",
    monthly: 4.99,
    yearly: 39,
    tagline: "Maximum coverage in your browser",
    features: [
      "12.5M+ blocked domains via extension",
      "Password lock, stealth & accountability hooks",
      "Auto-updated rulesets & streak stats"
    ]
  },
  {
    name: "Desktop Pro",
    planCode: "desktop_pro",
    monthly: 6.99,
    yearly: 59,
    tagline: "System-wide — every app obeys the block",
    features: [
      "12.5M+ domains at the OS/DNS layer",
      "Runs outside the browser sandbox",
      "Built for setups where extensions are not enough"
    ]
  },
  {
    name: "Bundle",
    planCode: "bundle_pro",
    monthly: 8.99,
    yearly: 79,
    tagline: "Extension + Desktop + Partner tools",
    popular: true,
    features: [
      "Everything in Chrome Pro & Desktop Pro",
      "Partner relay & richer alerts (plan-gated)",
      "Best long-term value for power users"
    ]
  }
];

function yearlySavingsPercent(monthly: number, yearly: number): number {
  const full = monthly * 12;
  if (full <= 0) return 0;
  return Math.max(0, Math.round((1 - yearly / full) * 100));
}

function formatMoney(n: number): string {
  return n
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const maxAnnualSavingsPct = Math.max(
  ...plans.map((plan) => yearlySavingsPercent(plan.monthly, plan.yearly))
);

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>("year");
  const [loading, setLoading] = useState<PlanCodeApi | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then(async (response) => {
        if (!response.ok) {
          if (cancelled) return;
          setSignedIn(false);
          setUserEmail(null);
          return;
        }
        const json = (await response.json()) as {
          user?: { email?: string };
        };
        if (cancelled) return;
        setSignedIn(true);
        setUserEmail(typeof json?.user?.email === "string" ? json.user.email : null);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubscribe = useCallback(
    async (planCode: PlanCodeApi) => {
      setFatal(null);
      if (signedIn === false) {
        setFatal("Please sign in on the home page before subscribing.");
        return;
      }
      setLoading(planCode);
      try {
        const res = await fetch("/api/billing/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planCode,
            interval: billing === "year" ? "annual" : "monthly"
          })
        });
        const data = (await res.json().catch(() => ({}))) as {
          checkoutUrl?: string | null;
          error?: string;
          message?: string;
        };

        if (res.status === 401) {
          setSignedIn(false);
          setFatal(data.message || "Session expired. Please sign in again.");
          return;
        }

        if (!res.ok) {
          setFatal(
            typeof data.error === "string"
              ? data.error
              : "Checkout could not start. Price IDs may not be configured on the server."
          );
          return;
        }

        const url = data.checkoutUrl;
        if (typeof url === "string" && url.startsWith("http")) {
          window.location.href = url;
          return;
        }
        setFatal("Checkout URL missing from server response.");
      } catch {
        setFatal("Network error. Check your connection and try again.");
      } finally {
        setLoading(null);
      }
    },
    [billing, signedIn]
  );

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>PureSignal</p>
          <h1 className={styles.title}>Guard your signal</h1>
          <p className={styles.subtitle}>
            Silence the noise. Block <strong>12.5 million</strong> adult domains with blocklists built for real coverage
            — not toy lists.
          </p>
        </header>

        {signedIn === false && (
          <div className={styles.authBanner}>
            <p className={styles.authBannerTitle}>Sign in to purchase</p>
            <p>
              Use the account login on the{" "}
              <Link href="/?loginRequired=1">home page</Link>, then return here to continue to Stripe Checkout.
            </p>
          </div>
        )}

        {signedIn === true && userEmail && (
          <p className={styles.notice} style={{ marginBottom: "1.5rem" }}>
            Signed in as <strong>{userEmail}</strong>
          </p>
        )}

        {fatal && <div className={styles.errorBanner}>{fatal}</div>}

        <div className={styles.toggleWrap}>
          <div className={styles.toggle} role="group" aria-label="Billing period">
            <button
              type="button"
              className={billing === "month" ? styles.toggleActive : ""}
              onClick={() => setBilling("month")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === "year" ? styles.toggleActive : ""}
              onClick={() => setBilling("year")}
            >
              Yearly
              <span className={styles.badgeSave}>Save up to ~{maxAnnualSavingsPct}%</span>
            </button>
          </div>
        </div>

        <div className={styles.grid}>
          {plans.map((plan) => {
            const save = yearlySavingsPercent(plan.monthly, plan.yearly);
            const yearEquiv = (plan.yearly / 12).toFixed(2);
            const showPrice = billing === "year" ? plan.yearly : plan.monthly;
            const periodLabel = billing === "year" ? "yr" : "mo";

            return (
              <article
                key={plan.planCode}
                className={`${styles.card} ${plan.popular ? styles.cardPopular : ""}`}
              >
                {plan.popular && <span className={styles.ribbon}>Most popular</span>}
                <h2 className={styles.cardTitle}>{plan.name}</h2>
                <p className={styles.cardDesc}>{plan.tagline}</p>
                <ul className={styles.featureList}>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <div className={styles.priceBlock}>
                  <div className={styles.priceMain}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.amount}>{formatMoney(showPrice)}</span>
                    <span className={styles.period}>/{periodLabel}</span>
                  </div>
                  {billing === "year" && (
                    <p className={styles.equiv}>
                      <strong>${yearEquiv}/mo</strong> equivalent · save ~{save}% vs paying monthly
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${styles.cta} ${plan.popular ? styles.ctaPrimary : ""}`}
                  disabled={loading !== null || signedIn === false || signedIn === null}
                  onClick={() => handleSubscribe(plan.planCode)}
                >
                  {loading === plan.planCode ? "Opening secure checkout…" : "Subscribe with Stripe"}
                </button>
              </article>
            );
          })}
        </div>

        <footer className={styles.notice}>
          <strong>14-day satisfaction</strong> policy · Cancel anytime from the Stripe billing portal · Prices in USD ·
          Taxes may apply based on region
        </footer>
      </div>
    </div>
  );
}
