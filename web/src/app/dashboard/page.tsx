import { DeviceList } from "../../components/device-list";
import { DashboardClient } from "../../components/dashboard-client";

export default function DashboardPage() {
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
