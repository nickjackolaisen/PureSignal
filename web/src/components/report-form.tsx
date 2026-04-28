"use client";

import { FormEvent, useState } from "react";

export function ReportForm() {
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      domain: (form.elements.namedItem("domain") as HTMLInputElement).value,
      reason: (form.elements.namedItem("reason") as HTMLTextAreaElement).value
    };

    const response = await fetch("http://localhost:8787/v1/support/report-site", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-support-target": "false_positive_queue"
      },
      body: JSON.stringify(body)
    });
    setStatus(response.ok ? "Report submitted." : "Could not submit report.");
    form.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="report-email">Email</label>
      <input id="report-email" name="email" type="email" required />
      <label htmlFor="domain">Domain to report</label>
      <input id="domain" name="domain" type="text" required />
      <label htmlFor="reason">Reason</label>
      <textarea id="reason" name="reason" rows={4} required />
      <button type="submit">Submit report</button>
      <p className="muted">{status}</p>
    </form>
  );
}
