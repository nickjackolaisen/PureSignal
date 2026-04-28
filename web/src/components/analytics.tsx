"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

export function AnalyticsTracker() {
  useEffect(() => {
    window.plausible?.("pageview");
  }, []);

  return null;
}
