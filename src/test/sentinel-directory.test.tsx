import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "@/hooks/auth-context";
import BehoerdeNetwork from "@/pages/BehoerdeNetwork";
import { fetchSentinelPage } from "@/lib/sentinel-directory";

vi.mock("@/integrations/external/supabase", () => ({ useExternalSupabase: () => client }));
vi.mock("@/lib/sentinel-directory", () => ({ fetchSentinelPage: vi.fn() }));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/SiteFooter", () => ({ SiteFooter: () => null }));
const client = {};
const auth: AuthContextValue = {
  user: { id: "staff", email: "staff@example.test", displayName: "Staff", emailVerified: true },
  isAdmin: false, isBehoerde: false, isEinrichtung: true, isSentinel: false,
  isExpert: false, canBrowseSentinels: true, region: "Bayern", role: "einrichtung",
  loading: false, signOut: async () => {},
};
const row = (name: string, region: string) => ({ user_id: name, case_id: "ST-TEST", full_name: name,
  email: `${name}@example.test`, region, experience_years: 5, species_focus: "Python", capacity: "2",
  motivation: "Care", tier: "S1", status: "approved", created_at: "2026-01-01", pledge_data: null });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("triage directory", () => {
  it.each(["einrichtung", "behoerde"] as const)("shows nationwide candidates and contact details to %s", async role => {
    vi.mocked(fetchSentinelPage).mockResolvedValue([row("BerlinSentinel","Berlin"), row("BayernSentinel","Bayern")]);
    render(<MemoryRouter><AuthContext.Provider value={{...auth,role,isBehoerde:role==="behoerde",isEinrichtung:role==="einrichtung"}}><BehoerdeNetwork /></AuthContext.Provider></MemoryRouter>);
    expect(await screen.findByText("BerlinSentinel")).toBeInTheDocument();
    expect(screen.getByText("BayernSentinel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BerlinSentinel@example.test" })).toHaveAttribute("href","mailto:BerlinSentinel@example.test");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Python" } });
    await waitFor(() => expect(fetchSentinelPage).toHaveBeenLastCalledWith(client,expect.objectContaining({ search: "Python" })));
  });
  it("does not query the directory for ordinary accounts", () => {
    render(<MemoryRouter><AuthContext.Provider value={{...auth,role:"user",isEinrichtung:false,canBrowseSentinels:false}}><BehoerdeNetwork /></AuthContext.Provider></MemoryRouter>);
    expect(screen.getByText("Zugang für Einrichtungen und Behörden")).toBeInTheDocument();
    expect(fetchSentinelPage).not.toHaveBeenCalled();
  });
});
