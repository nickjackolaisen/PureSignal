export default function PricingPage() {
  return (
    <section>
      <h2>Pricing</h2>
      <p className="muted">Billing is managed through Stripe.</p>
      <h3>Free</h3>
      <ul>
        <li>Core blocking</li>
        <li>Basic streak and attempt stats</li>
      </ul>
      <h3>Pro</h3>
      <ul>
        <li>Extension Pro (monthly/annual)</li>
        <li>Desktop Pro (monthly/annual)</li>
        <li>Bundle Pro (discounted combined plan)</li>
      </ul>
      <p className="muted">
        Checkout and portal sessions are provisioned via `/v1/billing/create-checkout` and `/v1/billing/create-portal`.
      </p>
    </section>
  );
}
