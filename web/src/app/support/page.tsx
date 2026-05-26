import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support | PureSignal",
  description: "Get help with PureSignal extension setup, troubleshooting, and billing."
};

export default function SupportPage() {
  return (
    <section style={{ maxWidth: "700px", margin: "0 auto" }}>
      <h2>Support</h2>

      <h3>Getting started</h3>
      <ol>
        <li>
          Install the extension from the <Link href="https://chromewebstore.google.com">Chrome Web Store</Link>
        </li>
        <li>
          Create an account at <Link href="/dashboard">/dashboard</Link>
        </li>
        <li>Copy your User ID from the dashboard into the extension Options page</li>
        <li>The extension will sync your entitlements automatically</li>
      </ol>

      <h3>Common issues</h3>
      <dl>
        <dt>Extension not blocking sites</dt>
        <dd>Check that protection is enabled in the popup. Verify rulesets are loaded in Options.</dd>

        <dt>Subscription not showing</dt>
        <dd>Ensure you completed checkout and the User ID in the extension matches your dashboard.</dd>

        <dt>False positive (legitimate site blocked)</dt>
        <dd>
          Use the report form in the blocked page or <Link href="/#contact">contact us</Link> with the domain.
        </dd>
      </dl>

      <h3>Contact</h3>
      <p>
        For billing issues, account deletion, or other support requests, use the{" "}
        <Link href="/#contact">contact form</Link> or email <strong>support@puresignal.io</strong>.
      </p>
    </section>
  );
}
