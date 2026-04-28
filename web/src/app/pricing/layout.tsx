import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — PureSignal",
  description:
    "Compare Chrome Pro, Desktop Pro, and Bundle. Transparent pricing powered by Stripe — cancel anytime."
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
