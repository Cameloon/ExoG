-- Grant table-level permissions to authenticated and anon roles
-- Required by the new Supabase key system (sb_publishable_ / sb_secret_).
-- RLS policies still control per-row access.

-- Helper to grant on all columns (SELECT, INSERT, UPDATE, DELETE)
grant usage on schema public to authenticated, anon;

-- profiles
grant select, insert, update on public.profiles to authenticated;

-- sentinel_applications
grant select, insert, update on public.sentinel_applications to authenticated;

-- application_documents
grant select, insert on public.application_documents to authenticated;

-- application_audit_log
grant select, insert on public.application_audit_log to authenticated;

-- user_roles
grant select on public.user_roles to authenticated;

-- cites_species
grant select on public.cites_species to authenticated, anon;
