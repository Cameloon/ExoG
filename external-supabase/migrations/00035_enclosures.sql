-- 00035: Sentinel-managed enclosure list for the live "Kapazitäten · Anlagen"
-- grid (parity with the demo's per-slot view). One JSON array per profile:
-- [{id, type, sizeCm, status, occupiedBy?}]. Owner-managed; admins/authorities
-- read it through the existing profiles policies.

alter table public.profiles
  add column if not exists enclosures jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_enclosures_is_array;
alter table public.profiles
  add constraint profiles_enclosures_is_array
  check (jsonb_typeof(enclosures) = 'array');

-- 00022 revoked table-wide update; open exactly this column (owner policy
-- "Profiles: own update" still applies).
grant update (enclosures) on public.profiles to authenticated;
