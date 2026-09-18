import type { Database } from "@/integrations/supabase/types";

type ShelterRow = Database["public"]["Tables"]["shelters"]["Row"];
type ShelterContactRow = Database["public"]["Tables"]["shelter_contacts"]["Row"];
type WardRow = Database["public"]["Tables"]["ward_listings"]["Row"];
type RequestRow = Database["public"]["Tables"]["sentinel_shelter_requests"]["Row"];
type InterestRow = Database["public"]["Tables"]["ward_interest"]["Row"];

// Private fields live in shelter_contacts (00036); the app-facing shape stays
// flat so pages don't care which table a column comes from.
type ShelterPrivateFields = Pick<
  ShelterContactRow,
  "address" | "contact_email" | "contact_phone" | "lat" | "lng"
>;

export type Shelter = ShelterRow & ShelterPrivateFields;
export type Ward = WardRow;
export type ShelterRequest = RequestRow;
export type WardInterest = InterestRow & {
  ward: { common_name: string; case_code: string } | null;
};

export type ShelterInput = Database["public"]["Tables"]["shelters"]["Insert"] &
  ShelterPrivateFields;
export type ShelterRequestInput =
  Database["public"]["Tables"]["sentinel_shelter_requests"]["Insert"];
