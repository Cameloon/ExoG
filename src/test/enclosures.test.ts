import { describe, expect, it } from "vitest";
import { assignWardToEnclosure, capacityFromEnclosures, parseEnclosures, reflectWardAssignments } from "@/lib/enclosures";

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

describe("reflectWardAssignments", () => {
  it("makes the persisted per-ward assignment the source of occupancy", () => {
    const assigned = assignWardToEnclosure(
      [
        { id: "T-01", type: "Terrarium-Trocken", sizeCm: "", status: "frei" },
        { id: "T-02", type: "Terrarium-Feucht", sizeCm: "", status: "belegt", occupiedBy: "WARD-1" },
        { id: "T-03", type: "Aquaterrarium", sizeCm: "", status: "wartung" },
      ],
      "WARD-1",
      "T-01",
    );
    const enclosures = reflectWardAssignments(assigned, [{ case_code: "WARD-1" }]);

    expect(enclosures.map(({ id, status, occupiedBy }) => ({ id, status, occupiedBy }))).toEqual([
      { id: "T-01", status: "belegt", occupiedBy: "WARD-1" },
      { id: "T-02", status: "frei", occupiedBy: undefined },
      { id: "T-03", status: "wartung", occupiedBy: undefined },
    ]);
    expect(capacityFromEnclosures(enclosures)).toEqual({ used: 1, total: 3 });
  });
});
