import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "PureSignal",
  description: "Focus and accountability tools for digital wellbeing.",
  openGraph: {
    title: "PureSignal",
    description: "Build healthier browsing habits with practical blocking and accountability.",
    url: "https://puresignal.io",
    siteName: "PureSignal",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className}`}>
        <main>
          <header className="siteHeader">
            <h1 className="brandEyebrow">
              <Link href="/" className="brandEyebrowLink">
                PureSignal
              </Link>
            </h1>
            <p className="siteHeaderTagline">Guard your signal. Silence the noise.</p>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/features">Features</Link>
              <Link href="/pricing">Pricing</Link>
              <Link href="/security">Security</Link>
              <Link href="/support">Support</Link>
              <Link href="/legal">Legal</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/partner">Partner</Link>
            </nav>
          </header>
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  );
}
