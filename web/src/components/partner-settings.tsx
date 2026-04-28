"use client";

import { FormEvent, useState } from "react";

export function PartnerSettings() {
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saved partner settings.");
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="partnerEmail">Partner email</label>
      <input id="partnerEmail" name="partnerEmail" type="email" required />
      <label htmlFor="frequency">Digest frequency</label>
      <input id="frequency" name="frequency" type="text" defaultValue="weekly" />
      <label htmlFor="consent">
        <input id="consent" name="consent" type="checkbox" required /> I confirm consent for accountability alerts.
      </label>
      <button type="submit">Save partner setup</button>
      <p className="muted">{status}</p>
    </form>
  );
}
