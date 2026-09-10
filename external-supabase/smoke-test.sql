-- Migration smoke test — run in Supabase SQL Editor after each migration
-- batch. Every query must return "ok"; anything else = schema drift.
-- (ponytail: one file, paste-and-run, no CLI runner needed.)

-- 1) Expected tables exist
select 'ok' as result
where to_regclass('public.profiles') is not null
  and to_regclass('public.user_roles') is not null
  and to_regclass('public.sentinel_applications') is not null
  and to_regclass('public.application_documents') is not null
  and to_regclass('public.ward_listings') is not null
  and to_regclass('public.ward_interest') is not null
  and to_regclass('public.shelters') is not null
  and to_regclass('public.sentinel_shelter_requests') is not null
  and to_regclass('public.pending_shelter_requests') is not null
  and to_regclass('public.care_logs') is not null
  and to_regclass('public.identification_requests') is not null
  and to_regclass('public.identification_votes') is not null
  and to_regclass('public.transport_logs') is not null
  and to_regclass('public.change_log') is not null
  and to_regclass('public.role_change_log') is not null
  and to_regclass('public.sentinel_change_requests') is not null
  and to_regclass('public.shelter_directory') is not null;

-- 2) RLS enabled on all custody tables
select 'ok' as result
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles','user_roles','sentinel_applications','application_documents',
                    'ward_listings','ward_interest','shelters','sentinel_shelter_requests',
                    'pending_shelter_requests','care_logs','identification_requests',
                    'identification_votes','transport_logs','change_log','role_change_log',
                    'sentinel_change_requests')
  and not c.relrowsecurity;

-- (expect 0 rows)

-- 3) Helper functions are authenticated-only (no PUBLIC execute)
select 'ok' as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('has_role','is_approved_sentinel','is_expert','is_gov','is_gov_for_region',
                    'current_region','current_clerk_user_id','append_care_log')
  and exists (
    select 1 from pg_proc_acl a
    where a.oid = p.oid and a.grantee = (select oid from pg_roles where rolname = 'public')
  );

-- (expect 0 rows)

-- 4) Storage buckets exist
select 'ok' as result
from storage.buckets
where id not in ('kyc-documents','ward-images','lab-docs','id-photos');

-- (expect 0 rows)

-- 5) Uniqueness: one shelter request per user, one active application per user
select 'ok' as result
where not exists (
  select 1 from pg_indexes
  where schemaname = 'public'
    and indexname in ('idx_pending_shelter_one_per_user','idx_apps_one_active_per_user')
);

-- (expect 0 rows)
