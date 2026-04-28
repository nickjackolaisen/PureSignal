"use client";

import { useEffect, useState } from "react";

type Device = {
  id: string;
  name: string;
  type: "extension" | "desktop";
  appVersion: string;
  lastSeenAt: string;
};

export function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    // Placeholder until authenticated endpoints are wired.
    setDevices([
      {
        id: "dev_extension_1",
        name: "Chrome on MacBook",
        type: "extension",
        appVersion: "1.0.0",
        lastSeenAt: new Date().toISOString()
      }
    ]);
  }, []);

  return (
    <ul>
      {devices.map((device) => (
        <li key={device.id}>
          {device.name} ({device.type}) - {device.appVersion} - last seen {new Date(device.lastSeenAt).toLocaleString()}
        </li>
      ))}
    </ul>
  );
}
