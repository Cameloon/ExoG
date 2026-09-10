-- Keep one shelter-access request per account. Rejected users can reuse the
-- same row through the controlled reset policy below.

delete from public.pending_shelter_requests r
where r.id in (
  select id
  from (
    select id, row_number() over (partition by user_id order by created_at desc) as rn
    from public.pending_shelter_requests
  ) ranked
  where ranked.rn > 1
);

create unique index if not exists idx_pending_shelter_one_per_user
  on public.pending_shelter_requests(user_id);

drop policy if exists "ShelterReq: user reset own" on public.pending_shelter_requests;
create policy "ShelterReq: user reset own"
  on public.pending_shelter_requests for update
  to authenticated
  using (
    user_id = public.current_clerk_user_id()
    and status in ('pending', 'rejected')
  )
  with check (
    user_id = public.current_clerk_user_id()
    and status = 'pending'
  );
