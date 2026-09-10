-- Public network projection for shelters.
-- Approved users may discover institutions, but must not receive private
-- contact/address fields or exact home coordinates.
--
-- Semantics: this view is a DEFINER-style projection (no security_invoker).
-- The column list is therefore enforced, not just the UI path: even direct
-- `from('shelters')` access is irrelevant to approved sentinels because the
-- base-table policy for them is dropped below. Owners/admins keep full rows
-- via their own policies.
--
-- Contact details are intentionally absent everywhere; they surface only
-- through the shelter owner's own profile management.

drop view if exists public.shelter_directory;
create view public.shelter_directory
as
  select
    id,
    name,
    kind,
    region,
    description,
    capacity_notes,
    round(lat::numeric, 2)::double precision as lat,
    round(lng::numeric, 2)::double precision as lng,
    created_at,
    updated_at
  from public.shelters;

revoke all on public.shelter_directory from anon;
grant select on public.shelter_directory to authenticated;

-- Close the full-row read path for approved sentinels. Their sanctioned
-- access is the projection above; owners/admins keep direct access via
-- "Shelters: owner all" / "Shelters: admin all".
drop policy if exists "Shelters: vetted read" on public.shelters;
