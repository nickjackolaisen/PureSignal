"use client";

import { useEffect, useState } from "react";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const value = window.localStorage.getItem("cg_cookie_consent");
    if (!value) {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <section>
      <h3>Privacy choices</h3>
      <p className="muted">Allow privacy-first analytics and optional telemetry preferences.</p>
      <button
        onClick={() => {
          window.localStorage.setItem("cg_cookie_consent", "accepted");
          setSaved("Consent saved.");
          setVisible(false);
        }}
      >
        Accept
      </button>
      <button
        onClick={() => {
          window.localStorage.setItem("cg_cookie_consent", "rejected");
          setSaved("Preferences saved.");
          setVisible(false);
        }}
      >
        Reject non-essential
      </button>
      <p className="muted">{saved}</p>
    </section>
  );
}
