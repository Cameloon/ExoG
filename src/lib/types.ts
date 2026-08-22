import type { Database } from "@/integrations/supabase/types";

type ShelterRow = Database["public"]["Tables"]["shelters"]["Row"];
type WardRow = Database["public"]["Tables"]["ward_listings"]["Row"];
type RequestRow = Database["public"]["Tables"]["sentinel_shelter_requests"]["Row"];
type InterestRow = Database["public"]["Tables"]["ward_interest"]["Row"];

export type Shelter = ShelterRow;
export type Ward = WardRow;
export type ShelterRequest = RequestRow;
export type WardInterest = InterestRow & {
  ward: { common_name: string; case_code: string } | null;
};

export type ShelterInput = Database["public"]["Tables"]["shelters"]["Insert"];
export type ShelterRequestInput =
  Database["public"]["Tables"]["sentinel_shelter_requests"]["Insert"];
