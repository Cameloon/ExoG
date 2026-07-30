-- General, append-only audit trail for the core custody tables.
-- Complements application_audit_log (which covers the sentinel workflow).
-- Triggered on UPDATE/DELETE of ward_listings, ward_interest, shelters,
-- sentinel_shelter_requests. INSERT is not logged to keep volume low;
-- created_at already covers "who created when" for the owner.

create table if not exists public.change_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    text not null,
  action      text not null,                 -- UPDATE | DELETE
  table_name  text not null,
  record_id   text not null,
  changed_at  timestamptz not null default now()
);

alter table public.change_log enable row level security;

-- ponytail: append-only, admins can read, nobody can write/change except the trigger.
drop policy if exists "ChangeLog: admin select" on public.change_log;
create policy "ChangeLog: admin select"
  on public.change_log for select to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'));

revoke update, delete, insert on public.change_log from authenticated, service_role;

-- SELECT is needed for the admin Änderungsprotokoll view. Never rely on
-- Supabase default privileges — grant explicitly.
grant select on public.change_log to authenticated;

create or replace function public.log_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.change_log (actor_id, action, table_name, record_id)
  values (
    public.current_clerk_user_id(),
    tg_op,
    tg_table_name,
    coalesce((old.id)::text, (new.id)::text, 'unknown')
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists log_ward_listings on public.ward_listings;
create trigger log_ward_listings after update or delete on public.ward_listings
  for each row execute function public.log_change();

drop trigger if exists log_ward_interest on public.ward_interest;
create trigger log_ward_interest after update or delete on public.ward_interest
  for each row execute function public.log_change();

drop trigger if exists log_shelters on public.shelters;
create trigger log_shelters after update or delete on public.shelters
  for each row execute function public.log_change();

drop trigger if exists log_sentinel_shelter_requests on public.sentinel_shelter_requests;
create trigger log_sentinel_shelter_requests after update or delete on public.sentinel_shelter_requests
  for each row execute function public.log_change();
