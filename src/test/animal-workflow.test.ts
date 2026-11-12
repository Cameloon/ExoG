import { describe, expect, it } from "vitest";
import { documentPlan, protectionStatus, intakeType } from "@/lib/animal-workflow";
import { wardToCase } from "@/lib/care-logs";
import { documentRequirements, missingRequirements } from "@/lib/documents/requirements";
import { requiresPermitForCase } from "@/lib/documents/adoption-contract";

const record = wardToCase({ id: "ward", case_code: "CASE", common_name: "Python", scientific_name: "Python regius", cites_listing: "II", age_estimate: "3 Jahre", region: "Berlin", status: "available", images: [], intake_type: "found", origin_context: "Im Park gefunden", urgency: "critical", legal_custody: false, placement_type: "pflegestelle" });

describe("intake to documents", () => {
  it.each([['confiscated', 'seizure'], ['found', 'found'], ['surrendered', 'intake'], ['transferred', 'intake'], ['unknown', 'intake']] as const)("selects the proper template for %s", (origin, document) => {
    expect(documentPlan({ ...record, intakeType: origin }).primary).toBe(document);
    expect(documentPlan({ ...record, intakeType: origin }).recommended).toContain("cites");
  });
  it("carries actual intake, species, protection and risk into exported case data", () => {
    expect(record).toMatchObject({ wardId: "ward", intakeType: "found", origin: "Fund", originContext: "Im Park gefunden", cites: "II", risk: "kritisch", legalCustody: false });
    expect(intakeType(null)).toBe("unknown");
    expect(intakeType("Behörde")).toBe("unknown");
  });
  it("never equates an unknown result with unprotected or a CITES appendix with an EU annex", () => {
    expect(protectionStatus(null).kind).toBe("unknown");
    expect(protectionStatus("NC").kind).toBe("unlisted");
    expect(protectionStatus("I/II/NC")).toMatchObject({ kind: "cites", review: true });
    expect(protectionStatus("B").kind).toBe("eu");
    expect(documentPlan({ ...record, cites: "—" }).recommended).toEqual(["found"]);
  });
  it("can document missing origin papers without inventing a certificate number", () => {
    const missing = documentRequirements("cites", { certificateStatus: "missing", markerType: "Noch ungeklärt / keine Kennzeichnung dokumentiert" }, record).map((item) => item.key);
    expect(missing).toContain("missingEvidence"); expect(missing).not.toContain("citesCertificateNo"); expect(missing).not.toContain("markerId");
    const present = documentRequirements("cites", { certificateStatus: "available", markerType: "Transponder" }, record).map((item) => item.key);
    expect(present).toEqual(expect.arrayContaining(["citesCertificateNo", "issuingAuthority", "issuedAt", "markerId"]));
  });
  it("requires genuine completion and explicit acknowledgements for the final template", () => {
    const requirements = documentRequirements("adoption", {}, record);
    const missing = missingRequirements(requirements, { adopterName: " ", hasSachkunde: false, experienceYears: "", housingDescription: "kurz" });
    expect(missing.map((item) => item.key)).toEqual(expect.arrayContaining(["adopterName", "hasSachkunde", "experienceYears", "housingDescription"]));
    expect(requiresPermitForCase({ ...record, cites: "II", risk: "stabil" })).toBe(false);
    expect(requiresPermitForCase({ ...record, cites: "I/II", risk: "stabil" })).toBe(true);
    expect(requiresPermitForCase({ ...record, cites: "II", risk: "stabil", legalCustody: true })).toBe(true);
  });
});
