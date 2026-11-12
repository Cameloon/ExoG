-- Role workflows: review and matching must succeed together with their records.
begin;
create or replace function public.review_sentinel_application(
  p_id uuid, p_status public.application_status, p_tier text, p_notes text default ''
) returns void language plpgsql security definer set search_path=public as $$
declare a public.sentinel_applications;
begin
  if not coalesce(public.has_role(public.current_clerk_user_id(),'admin'),false) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_status not in ('under_review','approved','rejected') or p_tier not in ('S1','S2','S3','S4')
    or p_status is null or p_tier is null or length(coalesce(p_notes,'')) > 2000 then
    raise exception 'invalid review';
  end if;
  select * into a from public.sentinel_applications where id=p_id for update;
  if not found then raise exception 'application not found'; end if;
  update public.sentinel_applications set status=p_status, tier=p_tier,
    reviewer_notes=p_notes, reviewed_by=public.current_clerk_user_id(), reviewed_at=now(),
    kyc_status=case when p_status='approved' then 'verified'::public.kyc_status else a.kyc_status end
    where id=p_id;
  insert into public.application_audit_log(application_id,actor_id,action,from_status,to_status,notes)
    values(p_id,public.current_clerk_user_id(),'status_change',a.status,p_status,
      concat('Stufe ',a.tier,' → ',p_tier, E'\n',p_notes));
end $$;
revoke all on function public.review_sentinel_application(uuid,public.application_status,text,text) from public,anon;
grant execute on function public.review_sentinel_application(uuid,public.application_status,text,text) to authenticated;

create or replace function public.match_ward_interest(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.ward_interest; w public.ward_listings; v_user text:=public.current_clerk_user_id();
begin
  -- Always lock the ward before requests: competing matches serialize.
  select * into w from public.ward_listings where id=(select ward_id from public.ward_interest where id=p_id) for update;
  if not found then raise exception 'request not found'; end if;
  if v_user is null or not coalesce((coalesce(public.has_role(v_user,'admin'),false) or w.owner_id=v_user
    or exists(select 1 from public.shelters s where s.id=w.shelter_id and s.owner_id=v_user)
    or (coalesce(auth.jwt()->>'app_role','') in ('behoerde','gov') and w.region=public.current_region())),false) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into r from public.ward_interest where id=p_id for update;
  if r.status='matched' and w.owner_id=r.applicant_id then return; end if;
  if r.status not in ('open','shortlisted') or w.status in ('placed','withdrawn')
    or not public.is_approved_sentinel(r.applicant_id) then raise exception 'request cannot be matched'; end if;
  if exists(select 1 from public.ward_interest i where i.ward_id=w.id and i.status='matched' and i.applicant_id=w.owner_id and i.id<>p_id) then
    raise exception 'ward already matched';
  end if;
  update public.ward_listings set owner_id=r.applicant_id,status='under_review' where id=w.id;
  update public.ward_interest set status='matched' where id=p_id;
end $$;
revoke all on function public.match_ward_interest(uuid) from public,anon;
grant execute on function public.match_ward_interest(uuid) to authenticated;
commit;
