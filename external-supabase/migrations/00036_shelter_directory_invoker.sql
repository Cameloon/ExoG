-- 00036: Shelter directory as SECURITY INVOKER (Supabase lint 0010).
--
-- RLS filters rows, not columns — a view that projects only public columns
-- out of a table that also holds private ones has to run with definer rights,
-- which is what the advisor flags. Split instead: private contact fields +
-- exact coordinates live in shelter_contacts (owner/admin RLS), shelters keeps
-- the public rounded map pin. The view then runs as the caller and needs no
-- definer bypass at all.
--
-- Idempotent: the column move only runs while shelters.address still exists.

create table if not exists public.shelter_contacts (
  shelter_id    uuid primary key references public.shelters(id) on delete cascade,
  address       text,
  contact_email text,
  contact_phone text,
  lat           double precision,
  lng           double precision,
  updated_at    timestamptz not null default now()
);

alter table public.shelter_contacts enable row level security;
grant select, insert, update, delete on public.shelter_contacts to authenticated;

drop policy if exists "ShelterContacts: owner all" on public.shelter_contacts;
create policy "ShelterContacts: owner all"
  on public.shelter_contacts for all
  to authenticated
  using (
    exists (
      select 1 from public.shelters s
      where s.id = shelter_contacts.shelter_id
        and s.owner_id = public.current_clerk_user_id()
    )
  )
  with check (
    exists (
      select 1 from public.shelters s
      where s.id = shelter_contacts.shelter_id
        and s.owner_id = public.current_clerk_user_id()
    )
  );

drop policy if exists "ShelterContacts: admin all" on public.shelter_contacts;
create policy "ShelterContacts: admin all"
  on public.shelter_contacts for all
  to authenticated
  using (public.has_role(public.current_clerk_user_id(), 'admin'))
  with check (public.has_role(public.current_clerk_user_id(), 'admin'));

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'shelters' and column_name = 'address'
  ) then
    insert into public.shelter_contacts (shelter_id, address, contact_email, contact_phone, lat, lng)
    select id, address, contact_email, contact_phone, lat, lng from public.shelters
    on conflict (shelter_id) do update
      set address       = excluded.address,
          contact_email = excluded.contact_email,
          contact_phone = excluded.contact_phone,
          lat           = excluded.lat,
          lng           = excluded.lng,
          updated_at    = now();

    -- public pin keeps only the coarse location
    update public.shelters
    set lat = case when lat is null then null else round(lat::numeric, 2)::double precision end,
        lng = case when lng is null then null else round(lng::numeric, 2)::double precision end;

    alter table public.shelters drop column if exists address;
    alter table public.shelters drop column if exists contact_email;
    alter table public.shelters drop column if exists contact_phone;
  end if;
end $$;

-- Rows for the directory: any signed-in user; private fields stay behind the
-- owner/admin policies on shelter_contacts.
drop policy if exists "Shelters: directory read" on public.shelters;
create policy "Shelters: directory read"
  on public.shelters for select
  to authenticated
  using (true);

drop view if exists public.shelter_directory;
create view public.shelter_directory
with (security_invoker = true)
as
  select
    id,
    name,
    kind,
    region,
    description,
    capacity_notes,
    lat,
    lng,
    created_at,
    updated_at
  from public.shelters;

revoke all on public.shelter_directory from anon;
grant select on public.shelter_directory to authenticated;
