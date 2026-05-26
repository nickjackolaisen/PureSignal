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
        <h3>Get the Chrome extension</h3>
        <p>
          Install PureSignal from the Chrome Web Store, then sign in on this site and paste your User ID from the
          dashboard into extension settings.
        </p>
        {process.env.NEXT_PUBLIC_CHROME_STORE_URL ? (
          <p>
            <a href={process.env.NEXT_PUBLIC_CHROME_STORE_URL} rel="noopener noreferrer">
              Install from Chrome Web Store
            </a>
          </p>
        ) : (
          <p className="muted">
            Chrome Web Store link will appear here after listing approval. Set{" "}
            <code>NEXT_PUBLIC_CHROME_STORE_URL</code> on Vercel.
          </p>
        )}
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
