-- Profile auto-creation support
-- Allows authenticated users to insert their own profile row
-- (the frontend creates it on first login).

alter table public.profiles enable row level security;

drop policy if exists "Profiles: own insert" on public.profiles;
create policy "Profiles: own insert"
  on public.profiles for insert to authenticated
  with check (id = public.current_clerk_user_id());
