import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

const ward = { id: "20000000-0000-0000-0000-000000000001", owner_id: "user_test", shelter_id: "shelter-1", case_code: "WARD-TEST", common_name: "Test-Bartagame", scientific_name: "Pogona vitticeps", cites_listing: "II", intake_type: "confiscated", origin_context: "", age_estimate: "3 Jahre", sex: "unbekannt", size_estimate: "", region: "Berlin", status: "available", urgency: "critical", images: [], background: "Testtier in Pflege", care_requirements: "Wärme", space_requirements: "Terrarium", placement_type: "pflegestelle", legal_custody: true, quarantine_status: "unknown", quarantine_until: null, lab_report_path: null, created_at: "2026-11-01T12:00:00Z" };
const app = { id: "app-1", case_id: "ST-TEST", user_id: "user_test", full_name: "Test Person", email: "test@example.test", region: "Berlin", status: "approved", kyc_status: "verified", tier: "S4", capacity: JSON.stringify({ desert: 2 }), experience_years: 3, species_focus: "Agamen", motivation: "Pflege", pledge_data: {}, created_at: "2026-11-01T12:00:00Z" };
const shelter = { id: "shelter-1", owner_id: "user_test", name: "Test-Einrichtung", kind: "shelter", region: "Berlin", lat: 52.52, lng: 13.405, created_at: "2026-11-01T12:00:00Z" };

async function setup(page: Page, role: string, fail = "", profileEnclosures: unknown[] = [], incomingRequests: unknown[] = []) {
  await page.addInitScript(({ role }) => { localStorage.setItem("test-role", role); localStorage.setItem("test-expert", "true"); }, { role });
  const calls: { path: string; method: string; body: unknown }[] = [];
  let storedWard = { ...ward };
  let storedAssignmentRequests = incomingRequests as Record<string, unknown>[];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.hostname === "photon.komoot.io") {
      const coordinates = url.searchParams.get("q")?.includes("14467") ? [13.065, 52.4] : [13.405, 52.52];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ features: [{ geometry: { coordinates } }] }) });
    }
    // No test can reach a real account, database, email provider or map service.
    if (url.hostname !== "ux-fixture.supabase.co") return route.abort();
    const path = url.pathname.split("/").at(-1)!;
    let body: Record<string, unknown> | null = null;
    try { body = request.postDataJSON(); } catch { /* binary upload */ }
    calls.push({ path, method: request.method(), body });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const headers = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (path === fail || `${path}:${request.method()}` === fail) return route.fulfill({ status: fail.includes(":") ? 400 : 503, headers, body: JSON.stringify({ message: "Test outage" }) });
    if (url.pathname.endsWith("/rpc/respond_authority_ward_assignment_request")) {
      storedAssignmentRequests = storedAssignmentRequests.filter((item) => item.id !== body?.p_id);
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body?.p_accept ? "accepted" : "declined") });
    }
    if (url.pathname.includes("/storage/v1/object/sign/") && request.method() === "POST") return route.fulfill({ status: 200, headers, body: JSON.stringify(((body?.paths ?? []) as string[]).map((path) => ({ path, signedURL: `/object/sign/ward-images/${path}?token=test`, error: null }))) });
    if (url.pathname.includes("/storage/v1/object/") && request.method() === "POST") return route.fulfill({ status: 200, headers, body: JSON.stringify({ Key: url.pathname.split("/object/")[1] }) });
    if (url.pathname.includes("/storage/v1/object/") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") });
    let data: unknown[] = ({
      ward_listings: [storedWard],
      authority_ward_assignment_requests: storedAssignmentRequests,
      cites_species: [{ full_name: "Python regius", current_listing: "II" }, { full_name: "Testudo hermanni", current_listing: "II" }], sentinel_applications: [{ ...app, status: role === "user" ? "pending" : "approved" }],
      profiles: [{ id: "user_test", display_name: "Test Person", enclosures: profileEnclosures }],
      shelters: [shelter], shelter_directory: [shelter], shelter_contacts: [],
      list_sentinels: [
        { ...app, pledge_data: { questionnaire: { zip: "10115", city: "Berlin" } } },
        { ...app, user_id: "other", full_name: "Sentinel Potsdam", region: "Brandenburg", pledge_data: { questionnaire: { zip: "14467", city: "Potsdam" } } },
      ],
      sentinel_region_counts: [{ region: "Berlin", total: 1 }, { region: "Bayern", total: 1 }],
      identification_requests: [{ id: "request-1", common_name: "Unbekannte Agame", photos: [], description: "Bitte bestimmen", created_at: "2026-11-01T12:00:00Z", status: "open" }],
    } as Record<string, unknown[]>)[path] ?? [];
    if (path === "sentinel_applications" && url.searchParams.get("status") === "eq.pending" && role !== "user") data = [{ ...app, status: "pending" }];
    if (request.method() !== "GET" && request.method() !== "HEAD" && !url.pathname.includes("/rpc/")) data = [{ id: "saved", ...body }];
    if (path === "ward_listings" && ["POST", "PATCH"].includes(request.method())) { storedWard = { ...storedWard, ...body }; data = [storedWard]; }
    const singular = request.headers().accept?.includes("vnd.pgrst.object");
    return route.fulfill({ status: 200, headers, body: JSON.stringify(singular ? data[0] ?? null : data) });
  });
  return calls;
}

for (const [role, path, title] of [
  ["sentinel", "/care", "Pflege-Log."], ["einrichtung", "/shelters", "Test-Einrichtung"],
  ["behoerde", "/behoerde", /Dashboard|Berlin/], ["admin", "/admin", /Review|Admin|Bewerbungen/],
  ["user", "/dashboard", /Willkommen/],
] as const) {
  test(`${role}: dashboard, navigation and mobile reflow`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
    await setup(page, role); await page.goto(path);
    await expect(page.locator("h1")).toContainText(title);
    await expect(page.getByRole("button", { name: "Menü öffnen" })).toBeVisible();
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile Navigation" }).getByRole("link", { name: "Konto" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 12).map((el) => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(overflow)).toBeTruthy();
    await page.screenshot({ path: `test-results/ux/${role}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1536, height: 1000 });
    await expect(page.getByRole("navigation", { name: "Hauptnavigation", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.screenshot({ path: `test-results/ux/${role}-desktop-light.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("care outage never shows demo profile and offers retry", async ({ page }) => {
  await setup(page, "sentinel", "ward_listings"); await page.goto("/care");
  await expect(page.getByRole("alert")).toContainText("Pflegebereich nicht verfügbar", { timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Erneut versuchen" })).toBeVisible();
  await expect(page.getByText("Dr. K. Hoffmann")).toHaveCount(0);
});

test("government can manage animals; details trap keyboard focus", async ({ page }) => {
  await setup(page, "behoerde"); await page.goto("/wards");
  await expect(page.getByRole("button", { name: "Ward einstellen" })).toBeVisible();
  await page.getByRole("heading", { name: "Test-Bartagame" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");
  expect(await page.getByRole("dialog").evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("staff directory exposes nationwide candidates", async ({ page }) => {
  await setup(page, "einrichtung"); await page.goto("/sentinels");
  await expect(page.getByText("Sentinel Potsdam", { exact: true })).toBeVisible();
});

test("pending applicant sees a status instead of another wizard", async ({ page }) => {
  await setup(page, "user"); await page.goto("/sentinel/apply");
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Eingegangen", { exact: true })).toBeVisible();
});


test("authority sees critical priority and can generate case documents", async ({ page }) => {
  await setup(page, "behoerde"); await page.goto("/behoerde");
  await page.getByRole("button", { name: "Dokumente", exact: true }).click();
  await expect(page.getByLabel("Ort der Maßnahme")).toBeVisible();
  await page.getByLabel("Ort der Maßnahme").fill("Testort");
  await page.getByLabel("Rechtsgrundlage").fill("Test-Bescheid");
  await page.getByLabel("Sachverhalt / Anlass").fill("Testfund zur Versorgung");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Dokument erstellen (PDF + JSON)", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});

test("admin explicitly selects expert qualification when reviewing", async ({ page }) => {
  const calls = await setup(page, "admin"); await page.goto("/admin");
  await page.getByText("Test Person", { exact: true }).first().click();
  await expect(page.getByLabel("Freigegebene Qualifikationsstufe")).toHaveValue("S4");
  await page.getByLabel("Freigegebene Qualifikationsstufe").selectOption("S3");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Freigeben|Genehmigen|Approve/i }).click();
  await expect.poll(() => calls.find((c) => c.path === "review_sentinel_application")?.body).toMatchObject({ p_tier: "S3", p_status: "approved" });
});

test("failed enclosure save retains the user's draft", async ({ page }) => {
  await setup(page, "sentinel", "profiles:PATCH"); await page.goto("/care");
  await page.getByRole("button", { name: "Erste Anlage anlegen" }).click();
  await page.getByLabel("Kürzel").fill("TEST-1");
  await page.getByRole("button", { name: /Anlage speichern|Speichern/ }).click();
  await expect(page.getByText("Nicht gespeichert. Deine Eingaben bleiben erhalten. Bitte erneut versuchen.")).toBeVisible();
  await expect(page.getByLabel("Kürzel")).toHaveValue("TEST-1");
});

test("sentinel assigns each ward to an enclosure and dashboard occupancy follows it", async ({ page }) => {
  const calls = await setup(page, "sentinel", "", [
    { id: "T-01", type: "Terrarium-Trocken", sizeCm: "120×60×60", status: "frei" },
  ]);
  await page.goto("/care");
  await expect(page.getByText("0 von 1 Plätzen belegt")).toBeVisible();
  await page.getByRole("combobox", { name: "Terrarium für WARD-TEST · Pflicht" }).click();
  await page.getByRole("option", { name: "T-01 · Terrarium-Trocken" }).click();
  await expect(page.getByText("1 von 1 Plätzen belegt")).toBeVisible();
  await expect(page.getByText("Alle Tiere zugeordnet")).toBeVisible();
  await expect.poll(() => calls.find((call) => call.path === "profiles" && call.method === "PATCH")?.body)
    .toMatchObject({ enclosures: [{ id: "T-01", occupiedBy: "WARD-TEST", status: "belegt" }] });
});

test("sentinel can accept or decline an authority's ward assignment request", async ({ page }) => {
  const calls = await setup(page, "sentinel", "", [], [
    { id: "request-accept", ward_id: "ward-2", authority_id: "gov-1", sentinel_id: "user_test", message: null, status: "open", created_at: "2026-11-01T12:00:00Z", ward: { case_code: "WARD-2", common_name: "Test-Kobra", region: "Berlin", urgency: "critical" } },
    { id: "request-decline", ward_id: "ward-3", authority_id: "gov-1", sentinel_id: "user_test", message: "Dringende Unterbringung", status: "open", created_at: "2026-11-01T13:00:00Z", ward: { case_code: "WARD-3", common_name: "Test-Python", region: "Berlin", urgency: "urgent" } },
  ]);
  await page.goto("/care");
  await expect(page.getByText("Test-Kobra · WARD-2")).toBeVisible();
  await page.getByRole("button", { name: "Annehmen" }).first().click();
  await expect(page.getByText("Test-Python · WARD-3")).toBeVisible();
  await page.getByRole("button", { name: "Ablehnen" }).first().click();
  await expect(page.getByRole("heading", { name: "Tieranfragen von Behörden" })).toHaveCount(0);
  expect(calls.filter((call) => call.path === "respond_authority_ward_assignment_request").map((call) => call.body)).toEqual([
    { p_id: "request-accept", p_accept: true },
    { p_id: "request-decline", p_accept: false },
  ]);
});

test("authority triage sends a request instead of transferring the ward immediately", async ({ page }) => {
  const calls = await setup(page, "behoerde");
  await page.goto("/behoerde");
  await page.locator("button").filter({ hasText: "Test-Bartagame" }).first().click();
  const sentinelSelect = page.getByRole("combobox", { name: "Sentinel anfragen" });
  await expect(sentinelSelect.locator('option[value="user_test"]')).toHaveCount(1, { timeout: 10_000 });
  await expect(sentinelSelect.locator('option[value="other"]')).toHaveCount(0);
  await page.getByRole("combobox", { name: "Suchradius" }).selectOption("50");
  await expect(sentinelSelect.locator('option[value="other"]')).toHaveCount(1);
  await sentinelSelect.selectOption("user_test");
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect.poll(() => calls.find((call) => call.path === "authority_ward_assignment_requests" && call.method === "POST")?.body)
    .toMatchObject({ ward_id: ward.id, authority_id: "user_test", sentinel_id: "user_test" });
  expect(calls.some((call) => call.path === "ward_listings" && call.method === "PATCH" && (call.body as Record<string, unknown>)?.owner_id)).toBe(false);
});


test("animal search reaches the server instead of filtering only the loaded page", async ({ page }) => {
  const calls = await setup(page, "behoerde");
  const searches: string[] = [];
  page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.endsWith("/ward_listings") && url.searchParams.has("or")) searches.push(url.searchParams.get("or")!); });
  await page.goto("/wards");
  await page.getByRole("searchbox", { name: "Wards durchsuchen" }).fill("Schildkröte");
  await expect.poll(() => searches.some((query) => query.includes("Schildkröte"))).toBe(true);
  expect(calls.some((c) => c.path === "ward_listings")).toBe(true);
});


test("sentinel can edit an owned animal without staff-only assignment controls", async ({ page }) => {
  const calls = await setup(page, "sentinel"); await page.goto("/wards");
  await page.getByRole("button", { name: /bearbeiten/i }).click();
  await expect(page.getByLabel("Bezeichnung", { exact: false })).toHaveValue("Test-Bartagame");
  await expect(page.getByLabel("Sentinel suchen")).toHaveCount(0);
  await page.getByLabel("Bezeichnung", { exact: false }).fill("Aktualisierte Bartagame");
  await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await expect.poll(() => calls.find((c) => c.path === "ward_listings" && c.method === "PATCH")?.body).toMatchObject({ common_name: "Aktualisierte Bartagame", owner_id: "user_test" });
});

test("a sentinel with approved shelter access keeps both workspaces", async ({ page }) => {
  await setup(page, "dual"); await page.goto("/shelters");
  await expect(page.getByRole("heading", { name: "Test-Einrichtung", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Menü öffnen" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile Navigation" });
  await expect(nav.getByRole("link", { name: "Meine Einrichtung", exact: true })).toBeVisible();
  await nav.getByRole("link", { name: "Übersicht", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pflege-Log." })).toBeVisible();
});

test("S4 expert can find identification requests and submit a vote", async ({ page }) => {
  const calls = await setup(page, "sentinel"); await page.goto("/care");
  await page.getByRole("button", { name: "Bestimmungshilfe", exact: true }).click();
  await expect(page.getByText("Unbekannte Agame", { exact: true })).toBeVisible();
  await page.getByLabel("Wiss. Name", { exact: true }).fill("Pogona vitticeps");
  await page.getByLabel("Sicherheit des Gutachtens").selectOption("hoch");
  await page.getByRole("button", { name: "Gutachten abgeben" }).click();
  await expect.poll(() => calls.find((c) => c.path === "identification_votes" && c.method === "POST")?.body).toMatchObject({ request_id: "request-1", species: "Pogona vitticeps", confidence: "hoch", expert_id: "user_test" });
});

test("Google sign-in keeps the requested page and has a callback route", async ({ page }) => {
  await setup(page, "anonymous"); await page.goto("/wards?search=WARD-TEST");
  await expect(page).toHaveURL(/auth/);
  await page.getByRole("button", { name: "Mit Google anmelden" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("test-oauth-request") ?? "null"))).toMatchObject({ redirectUrl: "/sso-callback", redirectUrlComplete: "/wards?search=WARD-TEST" });
  await page.goto("/sso-callback");
  await expect(page.getByTestId("clerk-callback")).toBeAttached();
});

test("Google sign-in failure is visible and allows another attempt", async ({ page }) => {
  await setup(page, "anonymous");
  await page.addInitScript(() => localStorage.setItem("test-oauth-fail", "true"));
  await page.goto("/auth");
  const google = page.getByRole("button", { name: "Mit Google anmelden" });
  await google.click();
  await expect(page.getByText("Google-Anmeldung nicht möglich", { exact: true })).toBeVisible();
  await expect(google).toBeEnabled();
});

test("a skipped theme transition still changes theme without an unhandled error", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await setup(page, "sentinel"); await page.goto("/care");
  await expect(page.getByRole("heading", { name: "Pflege-Log." })).toBeVisible();
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    Object.defineProperty(document, "startViewTransition", { value: (update: () => void) => {
      const transition = start(update); transition.skipTransition(); return transition;
    } });
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  expect(errors).toEqual([]);
});

async function downloadedJson(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent("download"); await click();
  const file = await download;
  const zip = await JSZip.loadAsync(await readFile((await file.path())!));
  const entry = Object.values(zip.files).find((item) => item.name.endsWith(".json"))!;
  return { json: JSON.parse(await entry.async("string")), zip };
}

test("species and intake flow through save into the suggested documents", async ({ page }) => {
  const calls = await setup(page, "behoerde"); await page.goto("/wards?new=1");
  await page.getByLabel("Case-Code").fill("FOUND-001");
  await page.getByLabel("Bezeichnung", { exact: false }).fill("Königspython");
  await page.getByLabel("Wiss. Name", { exact: true }).fill("Python regius");
  await expect(page.getByLabel("Schutzstatus (aus Artverzeichnis)")).toHaveValue("II");
  await page.getByLabel("Aufnahmegrund · Verpflichtend").selectOption("found");
  await page.getByLabel("Vorgeschichte & Verhalten").fill("Auf einem Parkplatz gefunden.");
  await page.getByLabel("Pflegeanforderungen").fill("Tierärztliche Untersuchung geplant");
  await page.getByLabel("Platz- & Haltungsanforderungen").fill("Gesicherte Quarantäneunterbringung");
  await page.getByRole("button", { name: "Speichern & Dokumente" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fundtier", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Fundumstände")).toHaveValue("Auf einem Parkplatz gefunden.");
  expect(calls.find((call) => call.path === "ward_listings" && call.method === "POST")?.body).toMatchObject({ scientific_name: "Python regius", cites_listing: "II", intake_type: "found", region: "Berlin" });
  await page.getByLabel("Fundort", { exact: false }).fill("Testparkplatz");
  await page.getByLabel("Finder:in (Name)").fill("Test Finder");
  const { json } = await downloadedJson(page, () => page.getByRole("button", { name: "Dokument erstellen (PDF + JSON)", exact: true }).click());
  expect(json.case).toMatchObject({ id: "FOUND-001", species: "Python regius", cites: "II", intakeType: "found", origin: "Fund" });
  expect(json.sender.org).toBe("Test Person");
  expect(json.completion).toEqual({ draft: false, missingFields: [] });
});

test("changing species with the same appendix does not lose the automatic CITES value", async ({ page }) => {
  await setup(page, "behoerde"); await page.goto("/wards?new=1");
  const species = page.getByLabel("Wiss. Name", { exact: true });
  await species.fill("Python regius");
  await expect(page.getByLabel("Schutzstatus (aus Artverzeichnis)")).toHaveValue("II");
  await species.fill("Testudo hermanni");
  await expect(page.getByLabel("Schutzstatus (aus Artverzeichnis)")).toHaveValue("II");
  await species.fill("Unbestimmte Art");
  await expect(page.getByLabel("Schutzstatus (aus Artverzeichnis)")).toHaveValue("");
});

test("incomplete documents identify missing fields and export an explicit draft", async ({ page }) => {
  await setup(page, "behoerde"); await page.goto("/wards");
  await page.getByRole("button", { name: "Dokumente vorbereiten" }).click();
  await page.getByRole("button", { name: "Dokument erstellen (PDF + JSON)", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Ort der Maßnahme");
  const { json, zip } = await downloadedJson(page, () => page.getByRole("button", { name: "Entwurf herunterladen" }).click());
  expect(json.completion.draft).toBe(true);
  expect(json.completion.missingFields).toContain("Rechtsgrundlage");
  expect(await zip.file("MANIFEST.txt")!.async("string")).toContain("ENTWURF / unvollständig");
});

test("surrendered animal gets an intake record and mobile document forms fit", async ({ page }) => {
  await setup(page, "einrichtung"); await page.goto(`/wards?edit=${ward.id}`);
  await page.getByLabel("Aufnahmegrund · Verpflichtend").selectOption("surrendered");
  await page.getByRole("button", { name: "Speichern & Dokumente" }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("button", { name: "Aufnahme / Abgabe", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Abgebende Person / Stelle").fill("Test Halter");
  await page.getByLabel("Kontakt der abgebenden Stelle").fill("test@example.test");
  const { json } = await downloadedJson(page, () => page.getByRole("button", { name: "Dokument erstellen (PDF + JSON)", exact: true }).click());
  expect(json.caseRecord.intakeType).toBe("surrendered");
  const dialog = page.getByRole("dialog");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await dialog.locator("[data-document-scroll]").evaluate((element) => { element.scrollTop = 0; });
  await dialog.screenshot({ path: "test-results/ux/intake-documents-mobile.png" });
});

test("Dashboard-fixes photo upload cleans up files after a failed save", async ({ page }) => {
  const calls = await setup(page, "sentinel", "ward_listings:PATCH"); await page.goto("/care");
  await page.getByRole("button", { name: "Pflege & Dokumente" }).click();
  await page.getByLabel("Tierfotos hinzufügen").setInputFiles({ name: "tier.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByText("Foto-Upload fehlgeschlagen", { exact: true })).toBeVisible();
  await expect.poll(() => calls.some((call) => call.path === "ward-images" && call.method === "DELETE")).toBe(true);
});

test("Dashboard-fixes photos can be added and removed in the care workspace", async ({ page }) => {
  const calls = await setup(page, "sentinel"); await page.goto("/care");
  await page.getByRole("button", { name: "Pflege & Dokumente" }).click();
  await page.getByLabel("Tierfotos hinzufügen").setInputFiles({ name: "tier.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") });
  await expect(page.getByRole("img", { name: "Ward-Foto" })).toBeVisible();
  expect(calls.some((call) => call.path === "ward_listings" && call.method === "PATCH")).toBe(true);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Foto entfernen" }).click();
  await expect(page.getByRole("img", { name: "Ward-Foto" })).toHaveCount(0);
  expect(calls.filter((call) => call.path === "ward_listings" && call.method === "PATCH").at(-1)?.body).toMatchObject({ images: [] });
});

test("document drafts survive template changes and a cancelled close", async ({ page }) => {
  await setup(page, "behoerde"); await page.goto("/wards");
  await page.getByRole("button", { name: "Dokumente vorbereiten" }).click();
  await page.getByLabel("Ort der Maßnahme").fill("Nicht verlieren");
  await page.getByRole("button", { name: "CITES-Übergabe", exact: true }).click();
  await page.getByRole("button", { name: "Sicherstellung", exact: true }).click();
  await expect(page.getByLabel("Ort der Maßnahme")).toHaveValue("Nicht verlieren");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Ort der Maßnahme")).toHaveValue("Nicht verlieren");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("opening an existing animal preserves its verified CITES classification", async ({ page }) => {
  const calls = await setup(page, "behoerde");
  await page.route("**/rest/v1/cites_species?**", (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: JSON.stringify([{ full_name: "Pogona vitticeps", current_listing: "I/II" }]) }));
  await page.goto(`/wards?edit=${ward.id}`);
  await expect(page.getByText("Artverzeichnis: CITES I/II. Die gespeicherte Angabe bleibt erhalten.")).toBeVisible();
  await expect(page.getByLabel("Schutzstatus (aus Artverzeichnis)")).toHaveValue("II");
  await page.getByRole("button", { name: "Änderungen speichern", exact: true }).click();
  await expect.poll(() => calls.find((call) => call.path === "ward_listings" && call.method === "PATCH")?.body).toMatchObject({ cites_listing: "II" });
});
