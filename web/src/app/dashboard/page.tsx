import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DeviceList } from "../../components/device-list";
import { DashboardClient } from "../../components/dashboard-client";
import { SESSION_COOKIE_NAME } from "../../lib/config";
import { parseSessionToken } from "../../lib/session";

export default async function DashboardPage() {
  const sessionToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!parseSessionToken(sessionToken)) {
    redirect("/?loginRequired=1");
  }

  return (
    <>
      <section>
        <h2>User dashboard</h2>
        <p className="muted">Manage devices, subscription status, and account actions.</p>
      </section>
      <section>
        <h3>Devices</h3>
        <DeviceList />
      </section>
      <section>
        <h3>Subscription</h3>
        <DashboardClient />
      </section>
      <section>
        <h3>Data controls</h3>
        <button>Export account data</button>
        <button>Delete account</button>
      </section>
    </>
  );
}
