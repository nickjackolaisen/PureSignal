import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — PureSignal",
  description:
    "Choose Chrome Pro, Desktop Pro, or Bundle. Block 12.5 million adult domains with subscription pricing via Stripe."
};

export default function SuccessPage() {
  return (
    <section style={{ textAlign: "center", padding: "3rem 1rem", maxWidth: "32rem", margin: "0 auto" }}>
      <h2>You&apos;re nearly there</h2>
      <p className="muted">
        Stripe will confirm payment in a few seconds. Once your subscription is active, sign in here with the same
        account — your entitlements sync automatically from our API.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/dashboard">Go to Dashboard</Link>
      </p>
      <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.9rem" }}>
        Questions? Visit <Link href="/support">support</Link>.
      </p>
    </section>
  );
}
