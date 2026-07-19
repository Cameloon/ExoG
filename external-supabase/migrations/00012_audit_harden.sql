-- Harden the application audit trail (forward migration, safe to re-run).
-- 1) Keep logs even if the application row is deleted (was on delete cascade).
-- 2) Make the log append-only: no update/delete, even for admins.

-- 1) Drop + recreate FK as SET NULL so logs survive application deletion.
alter table public.application_audit_log
  drop constraint if exists application_audit_log_application_id_fkey;

alter table public.application_audit_log
  add constraint application_audit_log_application_id_fkey
  foreign key (application_id)
  references public.sentinel_applications(id)
  on delete set null;

-- 2) Append-only: explicit deny policies for update/delete.
drop policy if exists "Audit: no update" on public.application_audit_log;
create policy "Audit: no update"
  on public.application_audit_log for update to authenticated using (false);

drop policy if exists "Audit: no delete" on public.application_audit_log;
create policy "Audit: no delete"
  on public.application_audit_log for delete to authenticated using (false);

-- ponytail: even service_role/secret key cannot mutate the trail directly.
revoke update, delete on public.application_audit_log from authenticated, service_role;
