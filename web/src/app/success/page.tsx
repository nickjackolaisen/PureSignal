import type { Metadata } from "next";
import { SuccessClient } from "./success-client";

export const metadata: Metadata = {
  title: "Thank you — PureSignal",
  description: "Your Stripe checkout completed. We are linking your subscription to your account."
};

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams;
  const sessionId = typeof sp.session_id === "string" && sp.session_id.startsWith("cs_") ? sp.session_id : null;
  return <SuccessClient sessionId={sessionId} />;
}
