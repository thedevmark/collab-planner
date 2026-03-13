"use client";

import { useEffect, useCallback } from "react";

export function useReminderPolling(enabled: boolean) {
  const checkReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders/pending");
      const reminders = await res.json();

      if (Array.isArray(reminders) && reminders.length > 0) {
        if ("Notification" in window && Notification.permission === "granted") {
          for (const reminder of reminders) {
            new Notification(`Reminder: ${reminder.event?.title ?? "Collab"}`, {
              body: reminder.label || "Your collab stream is coming up!",
              icon: "/favicon.ico",
            });
          }
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    checkReminders();
    const interval = setInterval(checkReminders, 60_000);
    return () => clearInterval(interval);
  }, [enabled, checkReminders]);
}
