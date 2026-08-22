import { describe, expect, it } from "vitest";
import { consensusSpecies } from "@/lib/consensus";

describe("consensusSpecies", () => {
  it("returns null with fewer than 2 matching votes", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: "B" },
      { species: "Python brongersmai", listing: "B" },
    ])).toBeNull();
  });

  it("returns the first species with >=2 votes", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: "B" },
      { species: "Python brongersmai", listing: null },
      { species: "Python regius", listing: "B" },
    ])).toEqual({ species: "Python regius", listing: "B", count: 2 });
  });

  it("returns null on empty votes", () => {
    expect(consensusSpecies([])).toBeNull();
  });

  it("keeps listing null when experts disagree on the listing", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: "B" },
      { species: "Python regius", listing: "A" },
    ])).toEqual({ species: "Python regius", listing: null, count: 2 });
  });

  it("takes the majority listing when >=2 votes agree", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: "B" },
      { species: "Python regius", listing: "A" },
      { species: "Python regius", listing: "B" },
    ])).toEqual({ species: "Python regius", listing: "B", count: 3 });
  });

  it("returns no listing on a 2-2 tie — no majority", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: "A" },
      { species: "Python regius", listing: "B" },
      { species: "Python regius", listing: "A" },
      { species: "Python regius", listing: "B" },
    ])).toEqual({ species: "Python regius", listing: null, count: 4 });
  });

  it("picks the most-voted species, not the first one to reach 2", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: "B" },
      { species: "Python regius", listing: "B" },
      { species: "Python brongersmai", listing: "B" },
      { species: "Python brongersmai", listing: "B" },
      { species: "Python brongersmai", listing: "B" },
    ])).toEqual({ species: "Python brongersmai", listing: "B", count: 3 });
  });

  it("breaks species ties deterministically (lexicographic)", () => {
    expect(consensusSpecies([
      { species: "Zebra", listing: "B" },
      { species: "Zebra", listing: "B" },
      { species: "Antilope", listing: "B" },
      { species: "Antilope", listing: "B" },
    ])).toEqual({ species: "Antilope", listing: "B", count: 2 });
  });

  it("returns null listing when the majority listing is a tie", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: null },
      { species: "Python regius", listing: "B" },
      { species: "Python regius", listing: "A" },
      { species: "Python regius", listing: "A" },
    ])).toEqual({ species: "Python regius", listing: null, count: 4 });
  });

  it("confirms a listing with a strict majority", () => {
    expect(consensusSpecies([
      { species: "Python regius", listing: null },
      { species: "Python regius", listing: "B" },
      { species: "Python regius", listing: "A" },
      { species: "Python regius", listing: "A" },
      { species: "Python regius", listing: "A" },
    ])).toEqual({ species: "Python regius", listing: "A", count: 5 });
  });
});
