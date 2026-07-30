-- 00018: Indexes for the hot query paths. All of these are hit on nearly
-- every page load and currently do sequential scans:
--   sentinel_applications(user_id)  — useAuth, Wards gate, Pledge, Care profile, shelter applicants
--   ward_listings(owner_id)         — /care "meine Wards" + owner RLS policies
--   care_logs(author_id, created_at) — 7d activity + count on the sentinel dashboard
--   application_audit_log(application_id), application_documents(application_id) — Admin detail view
--   change_log(changed_at)          — Admin Änderungsprotokoll ordering
-- FK columns are NOT auto-indexed in Postgres.

create index if not exists idx_apps_user on public.sentinel_applications(user_id);
create index if not exists idx_ward_listings_owner on public.ward_listings(owner_id);
create index if not exists idx_care_logs_author on public.care_logs(author_id, created_at desc);
create index if not exists idx_audit_log_app on public.application_audit_log(application_id);
create index if not exists idx_app_docs_app on public.application_documents(application_id);
create index if not exists idx_change_log_time on public.change_log(changed_at desc);
