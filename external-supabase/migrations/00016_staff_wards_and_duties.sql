-- 00016: Two things.
-- 1) Ward creation is staff-only: sentinels may NOT self-add wards. Wards are
--    created by admins, behörde/gov, or shelters — and assigned to an approved
--    sentinel (owner_id) or kept by the creator (shelter's own animals).
-- 2) Sentinel duties (the Übersicht todo list) get a real table so the live
--    dashboard survives reloads. Owner-only RLS.

-- ── 1) Ward insert: staff only ─────────────────────────────────────────────
drop policy if exists "Wards: owner insert" on public.ward_listings;
drop policy if exists "Wards: staff insert" on public.ward_listings;
do $$ begin
  create policy "Wards: staff insert"
    on public.ward_listings for insert
    to authenticated
    with check (
      (
        public.has_role(public.current_clerk_user_id(), 'admin')
        or (auth.jwt() ->> 'app_role') in ('behoerde', 'gov', 'shelter', 'einrichtung')
        or exists (
          select 1 from public.pending_shelter_requests r
          where r.user_id = public.current_clerk_user_id()
            and r.status = 'approved'
        )
      )
      and (
        -- keep the animal yourself (shelter stock) or assign to a vetted sentinel
        owner_id = public.current_clerk_user_id()
        or public.is_approved_sentinel(owner_id)
      )
    );
exception when duplicate_object then null;
end $$;

-- ── 2) Duties ──────────────────────────────────────────────────────────────
create table if not exists public.duties (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null,
  case_code  text,                 -- denormalized ward case code for display/jump
  title      text not null,
  category   text not null default 'Klima',
  priority   text not null default 'normal' check (priority in ('kritisch', 'hoch', 'normal')),
  due_at     timestamptz,
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_duties_owner on public.duties(owner_id, done, due_at);

alter table public.duties enable row level security;

drop policy if exists "Duties: owner all" on public.duties;
do $$ begin
  create policy "Duties: owner all"
    on public.duties for all
    to authenticated
    using (owner_id = public.current_clerk_user_id())
    with check (owner_id = public.current_clerk_user_id());
exception when duplicate_object then null;
end $$;

grant select, insert, update, delete on public.duties to authenticated;
