import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = "Asia/Kolkata";
export function formatDateTime(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { timeZone: IST, ...opts });
}
export function formatDate(value: string | Date | null | undefined) {
  return formatDateTime(value, { dateStyle: "medium" });
}
export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}
export function formatPercent(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(value);
}
/** Converts a Date to the value expected by <input type="datetime-local"> in IST. */
export function toLocalInputValue(value: string | Date) {
  const d = new Date(value);
  const ist = new Date(d.getTime() + 330 * 60_000);
  return ist.toISOString().slice(0, 16);
}
/** Parses a datetime-local value entered in IST. */
export function fromLocalInputValue(value: string) {
  return new Date(`${value}:00+05:30`).toISOString();
}
