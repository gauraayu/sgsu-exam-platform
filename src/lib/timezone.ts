/**
 * Timezone helpers. Timestamps are always stored in UTC; admins enter wall-clock times in the
 * exam's timezone (the university's configured zone by default) and everybody sees them there.
 */

export const UNIVERSITY_TIMEZONE = process.env.NEXT_PUBLIC_UNIVERSITY_TIMEZONE || "Asia/Kolkata";

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "India (IST, UTC+05:30)" },
  { value: "Asia/Dubai", label: "Gulf (GST, UTC+04:00)" },
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+08:00)" },
  { value: "Asia/Kathmandu", label: "Nepal (NPT, UTC+05:45)" },
  { value: "Asia/Dhaka", label: "Bangladesh (BST, UTC+06:00)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "UTC", label: "UTC" },
];

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
function zoneOffsetMs(utcMs: number, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(utcMs))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-20T10:00" entered in `tz` → UTC ISO string. */
export function zonedInputToUtc(value: string, tz: string = UNIVERSITY_TIMEZONE): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return "";
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = wall - zoneOffsetMs(wall, tz);
  // A second pass settles instants near daylight-saving transitions.
  utc = wall - zoneOffsetMs(utc, tz);
  return new Date(utc).toISOString();
}

/** UTC instant → value for <input type="datetime-local"> in `tz`. */
export function utcToZonedInput(value: string | Date, tz: string = UNIVERSITY_TIMEZONE): string {
  const ms = new Date(value).getTime();
  return new Date(ms + zoneOffsetMs(ms, tz)).toISOString().slice(0, 16);
}

/** Short zone label for an instant, e.g. "IST" or "GMT+4". */
export function zoneAbbreviation(tz: string = UNIVERSITY_TIMEZONE, at: Date = new Date()) {
  if (tz === "Asia/Kolkata") return "IST";
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((x) => x.type === "timeZoneName");
  return p?.value ?? tz;
}

export function formatInZone(value: string | Date | null | undefined, tz: string = UNIVERSITY_TIMEZONE, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleString("en-IN", { timeZone: tz, ...opts })} ${zoneAbbreviation(tz, d)}`;
}

/** "on 20 Nov 2026 at 10:00 am" in the exam's zone, for student-facing messages. */
export function formatDateAndTime(value: string | Date, tz: string = UNIVERSITY_TIMEZONE) {
  const d = new Date(value);
  const date = d.toLocaleDateString("en-IN", { timeZone: tz, dateStyle: "medium" });
  const time = d.toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return { date, time: `${time} ${zoneAbbreviation(tz, d)}` };
}
