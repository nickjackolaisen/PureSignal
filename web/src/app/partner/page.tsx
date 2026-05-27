import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PartnerSettings } from "../../components/partner-settings";
import { SESSION_COOKIE_NAME } from "../../lib/config";
import { parseSessionToken } from "../../lib/session";

export default async function PartnerPage() {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!parseSessionToken(sessionToken)) {
    redirect("/?loginRequired=1");
  }

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
