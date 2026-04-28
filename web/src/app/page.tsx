import { AnalyticsTracker } from "../components/analytics";
import { ConsentBanner } from "../components/consent-banner";
import { ContactForm } from "../components/contact-form";
import { LoginForm } from "../components/login-form";
import { ReportForm } from "../components/report-form";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ loginRequired?: string }>;
}) {
  const params = (await searchParams) || {};
  return (
    <>
      <AnalyticsTracker />
      <ConsentBanner />
      <section>
        <h2>Focus-first blocking and accountability</h2>
        <p>
          PureSignal helps users reduce compulsive browsing with strong site blocking, friction for impulsive
          disable attempts, and optional accountability workflows.
        </p>
      </section>
      <section>
        <h3>How it works</h3>
        <ul>
          <li>Chrome extension with high-scale declarative rules.</li>
          <li>Accountability alerts with explicit consent.</li>
          <li>Stats, streaks, and urge logging.</li>
        </ul>
      </section>
      <section>
        <h3>Account login</h3>
        <LoginForm loginRequired={params.loginRequired === "1"} />
      </section>
      <section>
        <h3>Contact</h3>
        <ContactForm />
      </section>
      <section>
        <h3>Report a false positive</h3>
        <ReportForm />
      </section>
    </>
  );
}
