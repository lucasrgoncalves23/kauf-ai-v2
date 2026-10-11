import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  newToken,
  isTokenShaped,
  hashToken,
  hashCpf,
  hmacEqual,
  encryptToken,
  decryptToken,
  isPortalConfigured,
  PortalNotConfiguredError,
} from "../portal/crypto";

const SECRET = "test-secret-with-at-least-thirty-two-characters-ok";

describe("portal crypto", () => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.PORTAL_SECRET;
    process.env.PORTAL_SECRET = SECRET;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.PORTAL_SECRET;
    else process.env.PORTAL_SECRET = previous;
  });

  it("generates 43-char base64url tokens that are unique", () => {
    const a = newToken();
    const b = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(isTokenShaped(a)).toBe(true);
    expect(isTokenShaped(a + "x")).toBe(false);
    expect(isTokenShaped("../etc/passwd")).toBe(false);
    expect(isTokenShaped(42)).toBe(false);
  });

  it("hashes deterministically with domain separation", () => {
    const t = newToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken("52998224725")).not.toBe(hashCpf("52998224725"));
  });

  it("compares HMACs in constant time without leaking on length", () => {
    const h = hashCpf("52998224725");
    expect(hmacEqual(h, hashCpf("52998224725"))).toBe(true);
    expect(hmacEqual(h, hashCpf("52998224726"))).toBe(false);
    expect(hmacEqual(h, "")).toBe(false);
    expect(hmacEqual("", "")).toBe(false);
  });

  it("round-trips token encryption and rejects tampering", () => {
    const t = newToken();
    const enc = encryptToken(t);
    expect(enc).not.toContain(t);
    expect(decryptToken(enc)).toBe(t);
    expect(encryptToken(t)).not.toBe(enc);
    const tampered = enc.slice(0, -2) + (enc.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("fails closed when PORTAL_SECRET is missing or too short", () => {
    delete process.env.PORTAL_SECRET;
    expect(isPortalConfigured()).toBe(false);
    expect(() => hashToken("x")).toThrow(PortalNotConfiguredError);
    process.env.PORTAL_SECRET = "short";
    expect(isPortalConfigured()).toBe(false);
  });

  it("derives different keys from different secrets", () => {
    const h1 = hashToken("same");
    process.env.PORTAL_SECRET = SECRET + "-other";
    expect(hashToken("same")).not.toBe(h1);
  });
});
