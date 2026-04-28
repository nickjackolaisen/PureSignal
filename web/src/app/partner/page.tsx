import { PartnerSettings } from "../../components/partner-settings";

export default function PartnerPage() {
  return (
    <>
      <section>
        <h2>Partner onboarding</h2>
        <p className="muted">
          Explain what is shared, how often alerts are sent, and how partners can opt out.
        </p>
        <PartnerSettings />
      </section>
      <section>
        <h3>Recent alerts</h3>
        <ul>
          <li>Blocked attempt (sample)</li>
          <li>Disable cooldown requested (sample)</li>
        </ul>
      </section>
    </>
  );
}
