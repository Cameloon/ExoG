import { describe, expect, it } from "vitest";
import { appNavigation, returnDestination, roleHome } from "@/lib/app-navigation";

describe("role journeys", () => {
  it("preserves a local deep link and rejects external or malformed destinations", () => {
    expect(returnDestination("/shelters/abc?tab=network#contact")).toBe("/shelters/abc?tab=network#contact");
    for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "/auth", "/unknown", null]) expect(returnDestination(value)).toBeNull();
  });
  it("gives authorities reachable animal, care, administration and national directory tools", () => {
    const links = appNavigation({ role: "behoerde", isAdmin: false, isBehoerde: true, isEinrichtung: false, isSentinel: false, canBrowseSentinels: true });
    expect(links.map((l) => l.href)).toEqual(["/behoerde", "/care", "/wards", "/sentinels", "/behoerde/verwaltung", "/shelters", "/account"]);
  });
  it("keeps ordinary applicants out of staff navigation with both application paths available", () => {
    const links = appNavigation({ role: "user", isAdmin: false, isBehoerde: false, isEinrichtung: false, isSentinel: false, canBrowseSentinels: false });
    expect(links.map((l) => l.href)).toEqual(["/dashboard", "/sentinel/apply", "/shelters", "/account"]);
    expect(roleHome("sentinel")).toBe("/care");
  });
});
