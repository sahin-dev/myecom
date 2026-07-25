"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "../lib/catalog";

export function AnalyticsBootstrap() {
  useEffect(() => {
    const key = "my-ecom-session-started";
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "true");
    void trackAnalyticsEvent({ type: "SESSION_STARTED" }).catch(() => {
      window.sessionStorage.removeItem(key);
    });
  }, []);

  return null;
}
