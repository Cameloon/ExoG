-- has_role(): single source of admin/role truth for DB RLS.
--
-- Checks BOTH:
--   1. the user_roles table (operator-bootstrapped, optional), and
--   2. the Clerk "app_role" claim carried in the Supabase JWT template.
--
-- The app already treats Clerk publicMetadata.role as authoritative for the
-- UI (useAuth.isAdmin etc.), so the DB RLS must agree. The claim is emitted
-- by the Clerk JWT template named "supabase" with a custom claim:
--     app_role = {{user.public_metadata.role}}
-- The JWT is signed by Clerk and verified by Supabase, so a user cannot
-- forge app_role = admin.
--
-- IMPORTANT: keep the JWT template's top-level "role" claim = "authenticated".
-- Supabase uses it to pick the Postgres role for the query; setting it to
-- "admin" would either fail or escalate privileges and bypass RLS. The app
-- admin flag lives ONLY in the custom "app_role" claim.
--
-- Apply order: after 00001 (which creates the original has_role). This
-- CREATE OR REPLACE swaps in the app_role branch with no table/data changes.

create or replace function public.has_role(_user_id text, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text = _role
  ) or (auth.jwt() ->> 'app_role') = _role
$$;
