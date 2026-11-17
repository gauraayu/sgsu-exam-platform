import { describe, expect, it } from "vitest";
import { assertSafeImportUrl, isPrivateAddress } from "@/lib/net/safe-fetch";

const resolver = (ip: string) => (async () => [{ address: ip, family: 4 }]) as never;

describe("SSRF protection", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1"])(
    "%s is private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it("public addresses are allowed", () => expect(isPrivateAddress("18.160.10.20")).toBe(false));

  const hosts = ["datasets-server.huggingface.co"];
  it("accepts an approved HTTPS host resolving publicly", async () => {
    const u = await assertSafeImportUrl("https://datasets-server.huggingface.co/rows?dataset=x", hosts, resolver("18.160.10.20"));
    expect(u.hostname).toBe("datasets-server.huggingface.co");
  });
  it.each([
    ["http://datasets-server.huggingface.co/rows", "HTTPS"],
    ["https://evil.example.com/rows", "not an approved"],
    ["https://127.0.0.1/rows", "IP-address"],
    ["https://user:pw@datasets-server.huggingface.co/rows", "credentials"],
    ["https://datasets-server.huggingface.co:8443/rows", "ports"],
  ])("rejects %s", async (url, msg) => {
    await expect(assertSafeImportUrl(url, hosts, resolver("18.160.10.20"))).rejects.toThrow(msg);
  });
  it("rejects approved hosts that resolve to internal addresses (DNS rebinding)", async () => {
    await expect(assertSafeImportUrl("https://datasets-server.huggingface.co/rows", hosts, resolver("169.254.169.254"))).rejects.toThrow("private");
  });
});
