import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal | PureSignal",
  description: "Privacy policy, terms of service, and cookie policy for PureSignal."
};

export default function LegalPage() {
  return (
    <section style={{ maxWidth: "800px", margin: "0 auto" }}>
      <h2>Legal</h2>

      <article id="privacy" style={{ marginTop: "2rem" }}>
        <h3>Privacy Policy</h3>
        <p className="muted" style={{ fontSize: "0.875rem" }}>
          Last updated: 2026-04-27
        </p>

        <h4>What we collect</h4>
        <ul>
          <li>Account data: email and authentication metadata</li>
          <li>Subscription data: plan and billing status from Stripe</li>
          <li>Device metadata: app version, platform, last sync timestamp</li>
          <li>Product events (opt-in telemetry): sync success/failure, rule counts, non-sensitive errors</li>
          <li>Accountability settings: partner contact destination and delivery preferences</li>
        </ul>

        <h4>What we do not collect by default</h4>
        <ul>
          <li>Full browsing history</li>
          <li>Full URL payloads for blocked events</li>
          <li>Keystrokes or clipboard contents</li>
        </ul>

        <h4>Accountability alerts and screenshots</h4>
        <p>
          If you enable accountability features, PureSignal can send alerts for selected events. Any screenshot capture
          is best-effort and only when the platform allows it. This behavior is disabled unless you configure it.
        </p>

        <h4>Why we process data</h4>
        <ul>
          <li>Provide blocking and sync features</li>
          <li>Process subscriptions and invoices</li>
          <li>Deliver accountability alerts when enabled</li>
          <li>Improve reliability and support</li>
        </ul>

        <h4>Processors</h4>
        <ul>
          <li>Stripe (payments)</li>
          <li>Hosting and observability providers</li>
        </ul>

        <h4>User controls</h4>
        <ul>
          <li>Export account data (where available)</li>
          <li>Delete account and request data deletion</li>
          <li>Disable optional telemetry</li>
        </ul>
      </article>

      <article id="terms" style={{ marginTop: "2rem" }}>
        <h3>Terms of Service</h3>
        <p>
          By using PureSignal, you agree to these terms. PureSignal provides content filtering tools on a best-effort
          basis. We do not guarantee prevention of all access to blocked content. Platform limitations may affect
          certain features.
        </p>
        <p>
          Subscriptions are billed through Stripe. Cancellation takes effect at the end of your billing period. Refunds
          are at our discretion.
        </p>
        <p>
          You must be at least 18 years old to subscribe. Do not use PureSignal for illegal activity or to violate the
          terms of other services.
        </p>
      </article>

      <article id="cookies" style={{ marginTop: "2rem" }}>
        <h3>Cookie Policy</h3>
        <p>
          We use cookies to maintain your login session and store preferences. The extension uses local storage for
          settings and stats. We do not use tracking cookies for advertising.
        </p>
        <p>
          Essential cookies cannot be disabled as they are required for the service to function. You can clear cookies
          at any time in your browser settings.
        </p>
      </article>

      <p className="muted" style={{ marginTop: "2rem" }}>
        For legal requests, contact support@puresignal.io
      </p>
    </section>
  );
}
