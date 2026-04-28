"use client";

import { FormEvent, useState } from "react";

export function LoginForm({ loginRequired }: { loginRequired: boolean }) {
  const [status, setStatus] = useState(loginRequired ? "Please sign in to continue." : "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      setStatus("Sign in failed.");
      return;
    }
    setStatus("Signed in. Redirecting to dashboard...");
    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="login-email">Sign in email</label>
      <input id="login-email" name="email" type="email" required />
      <button type="submit">Sign in</button>
      <p className="muted">{status}</p>
    </form>
  );
}
