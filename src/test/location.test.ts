import { describe, expect, it } from "vitest";
import { distanceKm, postalCityQuery } from "@/lib/location";

describe("postalCityQuery", () => {
  it("extracts only postal code and city from a private street address", () => {
    expect(postalCityQuery("Musterstraße 4 · 12345 Beispielstadt")).toBe("12345 Beispielstadt, Deutschland");
  });
});

describe("distanceKm", () => {
  it("calculates great-circle distances", () => {
    expect(distanceKm([0, 0], [0, 0])).toBe(0);
    expect(distanceKm([0, 0], [0, 1])).toBeCloseTo(111.2, 0);
  });
});
