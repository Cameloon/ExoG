-- Care logs: the persistent, append-only custody record per ward.
-- Each entry is hash-chained to the previous one client-side (tamper-evident,
-- not a qualified signature). There are intentionally NO update/delete
-- policies: at the RLS level the log is append-only, which is the feature.
-- (Service role can still clean up, e.g. for test data.)

create table if not exists public.care_logs (
  id          uuid primary key default gen_random_uuid(),
  ward_id     uuid not null references public.ward_listings(id) on delete cascade,
  author_id   text not null,
  author_name text not null,
  type        text not null check (type in ('Fütterung', 'Medizin', 'Beobachtung', 'Klima', 'Reinigung')),
  note        text not null,
  rationale   text not null default '',
  metrics     jsonb not null default '{}'::jsonb,
  prev_hash   text,
  hash        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_care_logs_ward on public.care_logs(ward_id, created_at desc);

alter table public.care_logs enable row level security;

drop policy if exists "CareLogs: owner select" on public.care_logs;
do $$ begin
  create policy "CareLogs: owner select"
    on public.care_logs for select
    to authenticated
    using (exists (
      select 1 from public.ward_listings w
      where w.id = ward_id and w.owner_id = public.current_clerk_user_id()
    ));
exception when duplicate_object then null;
end $$;

drop policy if exists "CareLogs: admin select" on public.care_logs;
do $$ begin
  create policy "CareLogs: admin select"
    on public.care_logs for select
    to authenticated
    using (public.has_role(public.current_clerk_user_id(), 'admin'));
exception when duplicate_object then null;
end $$;

-- Behörde reads via the Clerk app_role JWT claim (same pattern as 00010).
drop policy if exists "CareLogs: behoerde select" on public.care_logs;
do $$ begin
  create policy "CareLogs: behoerde select"
    on public.care_logs for select
    to authenticated
    using ((auth.jwt() ->> 'app_role') in ('behoerde', 'gov'));
exception when duplicate_object then null;
end $$;

drop policy if exists "CareLogs: owner insert" on public.care_logs;
do $$ begin
  create policy "CareLogs: owner insert"
    on public.care_logs for insert
    to authenticated
    with check (
      author_id = public.current_clerk_user_id()
      and (
        public.has_role(public.current_clerk_user_id(), 'admin')
        or exists (
          select 1 from public.ward_listings w
          where w.id = ward_id and w.owner_id = public.current_clerk_user_id()
        )
      )
    );
exception when duplicate_object then null;
end $$;

grant select, insert on public.care_logs to authenticated;
