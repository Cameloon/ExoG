-- Grant table-level permissions for the shelter network + approval tables.
-- Migration 00005 granted the early tables but predated 00006/00007,
-- so `shelters` lacked INSERT privilege -> "permission denied for table shelters".
grant usage on schema public to authenticated, anon;

grant select, insert, update on public.shelters to authenticated;
grant select on public.shelters to anon;

grant select, insert, update, delete on public.sentinel_shelter_requests to authenticated;

grant select, insert, update on public.pending_shelter_requests to authenticated;
grant select on public.pending_shelter_requests to authenticated;
