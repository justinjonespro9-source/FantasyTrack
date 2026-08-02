import { DateTime } from "luxon";

/** Admin lock times are entered and displayed in US Central (handles CST/CDT). */
export const ADMIN_LOCK_TIME_ZONE = "America/Chicago";

export type CentralDateTimeParts = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
};

/**
 * Interpret a calendar date + wall-clock time in America/Chicago and return the UTC instant.
 */
export function parseCentralDateTime(date: string, time: string): Date {
  const dateTrim = date.trim();
  const timeTrim = time.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrim)) {
    throw new Error("Invalid date. Use YYYY-MM-DD.");
  }
  if (!/^\d{2}:\d{2}$/.test(timeTrim)) {
    throw new Error("Invalid time. Use HH:mm.");
  }

  const dt = DateTime.fromISO(`${dateTrim}T${timeTrim}`, {
    zone: ADMIN_LOCK_TIME_ZONE,
  });
  if (!dt.isValid) {
    throw new Error(dt.invalidExplanation || "Invalid date/time in Central Time.");
  }
  return dt.toUTC().toJSDate();
}

/** Split a UTC instant into date/time parts for Central Time form fields. */
export function toCentralDateTimeParts(instant: Date): CentralDateTimeParts {
  const dt = DateTime.fromJSDate(instant, { zone: "utc" }).setZone(ADMIN_LOCK_TIME_ZONE);
  return {
    date: dt.toFormat("yyyy-MM-dd"),
    time: dt.toFormat("HH:mm"),
  };
}

/** Display lock time for admin/public CT labels, e.g. "Sep 13, 2026 · 10:00 AM CT". */
export function formatLockTimeCt(instant: Date): string {
  const dt = DateTime.fromJSDate(instant, { zone: "utc" }).setZone(ADMIN_LOCK_TIME_ZONE);
  return `${dt.toFormat("MMM d, yyyy")} · ${dt.toFormat("h:mm a")} CT`;
}
