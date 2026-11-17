import { lookup } from "node:dns/promises";
import net from "node:net";
import { AppError } from "@/lib/errors";

/** True for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

export interface SafeUrlCheck {
  url: URL;
}

/**
 * Validates an import URL: HTTPS only, default port, no credentials, host on the approved list,
 * and every resolved address must be public. Throws AppError otherwise.
 */
export async function assertSafeImportUrl(raw: string, approvedHosts: string[], resolver: typeof lookup = lookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError("BAD_REQUEST", "Enter a valid URL.");
  }
  if (url.protocol !== "https:") throw new AppError("BAD_REQUEST", "Only HTTPS URLs are allowed.");
  if (url.username || url.password) throw new AppError("BAD_REQUEST", "URLs with embedded credentials are not allowed.");
  if (url.port && url.port !== "443") throw new AppError("BAD_REQUEST", "Custom ports are not allowed.");
  const host = url.hostname.toLowerCase();
  if (net.isIP(host)) throw new AppError("BAD_REQUEST", "IP-address URLs are not allowed. Use an approved hostname.");
  if (!approvedHosts.includes(host))
    throw new AppError("FORBIDDEN", `"${host}" is not an approved import host. Approved hosts: ${approvedHosts.join(", ") || "none"}.`);
  let addresses: { address: string }[];
  try {
    addresses = await resolver(host, { all: true });
  } catch {
    throw new AppError("UPSTREAM_ERROR", `Could not resolve ${host}.`);
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address)))
    throw new AppError("FORBIDDEN", "The import host resolves to a private or internal network address.");
  return url;
}

/** Fetches JSON from a validated URL without following redirects, with a timeout and size cap. */
export async function fetchJson(url: URL, opts: { token?: string; timeoutMs?: number; maxBytes?: number } = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    });
    if (res.status >= 300 && res.status < 400) throw new AppError("UPSTREAM_ERROR", "The import API tried to redirect; redirects are not followed for security.");
    if (!res.ok) throw new AppError("UPSTREAM_ERROR", `The import API responded with HTTP ${res.status}.`);
    const max = opts.maxBytes ?? 10 * 1024 * 1024;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > max) throw new AppError("PAYLOAD_TOO_LARGE", "The API response is too large.");
    const reader = res.body?.getReader();
    if (!reader) throw new AppError("UPSTREAM_ERROR", "Empty response from the import API.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel();
        throw new AppError("PAYLOAD_TOO_LARGE", "The API response is too large.");
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    try {
      return JSON.parse(text);
    } catch {
      throw new AppError("UPSTREAM_ERROR", "The import API did not return valid JSON.");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if ((err as Error).name === "AbortError") throw new AppError("UPSTREAM_ERROR", "The import API did not respond in time.");
    throw new AppError("UPSTREAM_ERROR", "Could not reach the import API.");
  } finally {
    clearTimeout(timer);
  }
}
