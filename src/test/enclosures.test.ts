import { describe, expect, it } from "vitest";
import { capacityFromEnclosures, parseEnclosures } from "@/lib/enclosures";

describe("parseEnclosures", () => {
  it("keeps valid slots and drops malformed rows", () => {
    const raw = [
      { id: "T-01", type: "Terrarium-Trocken", sizeCm: "120×60×60", status: "belegt", occupiedBy: "EG-1" },
      { id: "T-02", type: "Nope", sizeCm: "", status: "frei" },
      { id: "", type: "Quarantäne", status: "frei" },
      { id: "T-03", type: "Aquaterrarium", status: "bogus" },
      { id: "T-04", type: "Quarantäne", status: "belegt", occupiedBy: 7 },
      null,
    ];
    expect(parseEnclosures(raw)).toEqual([
      { id: "T-01", type: "Terrarium-Trocken", sizeCm: "120×60×60", status: "belegt", occupiedBy: "EG-1" },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(parseEnclosures(null)).toEqual([]);
    expect(parseEnclosures({})).toEqual([]);
  });
});

describe("capacityFromEnclosures", () => {
  it("counts belegte against total", () => {
    expect(
      capacityFromEnclosures([
        { id: "T-01", type: "Quarantäne", sizeCm: "", status: "belegt" },
        { id: "T-02", type: "Quarantäne", sizeCm: "", status: "frei" },
        { id: "T-03", type: "Quarantäne", sizeCm: "", status: "reinigung" },
      ]),
    ).toEqual({ used: 1, total: 3 });
  });

  it("returns null with no slots so callers fall back", () => {
    expect(capacityFromEnclosures([])).toBeNull();
  });
});
