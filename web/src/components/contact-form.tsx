"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = {
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value
    };

    const response = await fetch("http://localhost:8787/v1/support/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-support-target": "triage_queue"
      },
      body: JSON.stringify(body)
    });
    setStatus(response.ok ? "Message sent." : "Could not send message.");
    form.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required />
      <label htmlFor="message">Message</label>
      <textarea id="message" name="message" rows={4} required />
      <button type="submit">Send message</button>
      <p className="muted">{status}</p>
    </form>
  );
}
