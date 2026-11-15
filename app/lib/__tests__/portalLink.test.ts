import { describe, expect, it } from "vitest";
import { portalPublicUrl } from "../portal/link";

describe("portalPublicUrl", () => {
  it("builds the fragment link from the configured origin", () => {
    expect(portalPublicUrl("abc123", "https://kai-oskar.vercel.app")).toBe(
      "https://kai-oskar.vercel.app/portal#abc123"
    );
  });
  it("trims trailing slashes", () => {
    expect(portalPublicUrl("abc", "https://kai-oskar.vercel.app//")).toBe(
      "https://kai-oskar.vercel.app/portal#abc"
    );
  });
  it("returns null when the origin is missing or not http(s)", () => {
    expect(portalPublicUrl("abc", undefined)).toBeNull();
    expect(portalPublicUrl("abc", "  ")).toBeNull();
    expect(portalPublicUrl("abc", "kai-oskar.vercel.app")).toBeNull();
  });
});
