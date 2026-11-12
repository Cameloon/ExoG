import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

// Real PostgreSQL policies, grants, triggers and transactions, with only the
// external Supabase auth/storage schemas stubbed. Never connects to a server.
const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage; create schema extensions;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to service_role;
  alter default privileges in schema public grant all on tables to authenticated;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant all on storage.objects to authenticated, service_role;
  create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'),1)-1] $$;
  create function storage.extension(text) returns text language sql immutable as $$ select reverse(split_part(reverse($1), '.', 1)) $$;
`);
const root = new URL('../external-supabase/migrations/', import.meta.url);
for (const file of fs.readdirSync(root).filter(f => f.endsWith('.sql')).sort()) {
  const migration = fs.readFileSync(new URL(file, root), 'utf8');
  await db.exec(migration);
  if (file === '00038_review_remediation.sql') await db.exec(migration);
}
console.log('Fresh migration replay and remediation replay passed');

const query = async sql => (await db.query(sql)).rows;
const denied = async sql => assert.rejects(() => db.query(sql), /permission denied|row-level security|forbidden|request|recipient|identities|protected/i);
async function actor(sub, app_role = 'user', region) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub,app_role,region})]);
  await db.exec('set role authenticated');
}
const shelter = '10000000-0000-0000-0000-000000000001';
const ward = '20000000-0000-0000-0000-000000000001';
const govWard = '20000000-0000-0000-0000-000000000002';
await db.exec(`
  insert into public.sentinel_applications(user_id,case_id,full_name,email,region,experience_years,capacity,motivation,status,pledge_data) values
  ('victim','ST-VICTIM','Person','private@example.test','Berlin',5,'1','motivation','approved','{"questionnaire":{"street":"Street","phone":"123","birth_date":"1990-01-01"},"commitments":{"truthful":true}}'),
  ('sentinel','ST-SENTINEL','Sentinel','sentinel@example.test','Bayern',5,'1','motivation','approved','{}'),
  ('pending','ST-PENDING','Pending','pending@example.test','Berlin',1,'1','motivation','pending','{}');
  insert into public.profiles(id,email,region) values ('victim','private@example.test','Berlin');
  insert into public.pending_shelter_requests(user_id,email,status) values ('approved_shelter','shelter@example.test','approved');
  insert into public.shelters(id,owner_id,name,region) values ('${shelter}','shelter','Shelter','Bayern');
  insert into public.ward_listings(id,owner_id,shelter_id,case_code,common_name,background,care_requirements,space_requirements,region)
    values ('${ward}','victim','${shelter}','WARD-1','Animal','b','c','s','Berlin');
  insert into public.ward_listings(id,owner_id,case_code,common_name,background,care_requirements,space_requirements,region,visibility)
    values ('${govWard}','authority','WARD-GOV','Rescue animal','b','c','s','Bayern','admin_only');
`);

// Structured intake stays within the existing ward permissions.
await actor('victim');
assert.equal((await query(`select intake_type from public.ward_listings where id='${ward}'`))[0].intake_type, 'unknown');
await db.exec(`update public.ward_listings set intake_type='found' where id='${ward}'`);
await assert.rejects(() => db.query(`update public.ward_listings set intake_type='invented' where id='${ward}'`), /ward_intake_type_valid/);
await actor('ordinary');
await db.exec(`update public.ward_listings set intake_type='surrendered' where id='${ward}'`);
await actor('victim');
assert.equal((await query(`select intake_type from public.ward_listings where id='${ward}'`))[0].intake_type, 'found');
console.log('Intake defaults, valid values and existing ownership restrictions passed');

for (const [user, role] of [['shelter','einrichtung'],['gov','behoerde'],['admin','admin'],['approved_shelter','user']]) {
  await actor(user, role, 'Bayern');
  const directory = await query('select * from public.list_sentinels()');
  assert.equal(directory.length,2);
  const victim = directory.find(row => row.user_id === 'victim');
  assert.equal(victim.email,'private@example.test');
  assert.equal(victim.pledge_data.questionnaire.phone,'123');
  assert.ok(!('birth_date' in victim.pledge_data.questionnaire));
  assert.ok(!('commitments' in victim.pledge_data));
  assert.equal((await query('select * from public.sentinel_region_counts()')).length,2);
  const first = await query("select * from public.list_sentinels(null,1)");
  const second = await query(`select * from public.list_sentinels('${first[0].user_id}',1)`);
  assert.notEqual(first[0].user_id,second[0].user_id);
  if (role !== 'admin') assert.equal((await query("select * from public.sentinel_applications where user_id='victim'")).length,0);
}
await actor('ordinary');
await denied('select * from public.list_sentinels()');
await db.exec('reset role; set role anon');
await denied('select * from public.list_sentinels()');
console.log('Nationwide triage discovery, private-field redaction, role boundaries and pagination passed');

// Authority placement is request/consent based; a direct client-side owner transfer is forbidden.
await db.exec('reset role');
await db.exec(`insert into public.sentinel_applications(user_id,case_id,full_name,email,region,experience_years,capacity,motivation,status,pledge_data)
  values ('sentinel2','ST-SENTINEL-2','Sentinel Two','sentinel2@example.test','Bayern',3,'1','motivation','approved','{}')`);
await actor('authority','behoerde','Bayern');
assert.deepEqual(await query("select public.current_clerk_user_id() as uid, public.current_region() as region, public.is_gov_for_region('Bayern') as can_triage"),
  [{ uid: 'authority', region: 'Bayern', can_triage: true }]);
assert.deepEqual(await query(`select auth.jwt()->>'app_role' as role, public.is_approved_sentinel('sentinel') as approved,
  exists(select 1 from public.ward_listings w where w.id='${govWard}' and w.owner_id='authority'
    and w.status in ('available','under_review') and public.is_gov_for_region(w.region)) as ward_ok`),
  [{ role: 'behoerde', approved: true, ward_ok: true }]);
await assert.rejects(() => db.query(`update public.ward_listings set owner_id='sentinel' where id='${govWard}'`), /Authorities must request/);
await assert.rejects(() => db.query(`insert into public.ward_listings(owner_id,case_code,common_name,background,care_requirements,space_requirements,region)
  values ('sentinel','WARD-DIRECT','Animal','b','c','s','Bayern')`), /Authorities must request/);
const [{ id: declinedRequest }] = await query(`insert into public.authority_ward_assignment_requests(ward_id,authority_id,sentinel_id)
  values ('${govWard}','authority','sentinel') returning id`);
await assert.rejects(() => db.query(`insert into public.authority_ward_assignment_requests(ward_id,authority_id,sentinel_id)
  values ('${govWard}','authority','pending')`), /row-level security/);
await actor('sentinel');
assert.equal((await query('select id from public.authority_ward_assignment_requests')).length,1);
assert.equal((await query(`select id from public.ward_listings where id='${govWard}'`)).length,1);
await db.query(`select public.respond_authority_ward_assignment_request('${declinedRequest}',false)`);
assert.equal((await query(`select status from public.authority_ward_assignment_requests where id='${declinedRequest}'`))[0].status,'declined');
assert.equal((await query(`select id from public.ward_listings where id='${govWard}'`)).length,0);
await actor('authority','behoerde','Bayern');
assert.equal((await query(`select owner_id from public.ward_listings where id='${govWard}'`))[0].owner_id,'authority');
const [{ id: acceptedRequest }] = await query(`insert into public.authority_ward_assignment_requests(ward_id,authority_id,sentinel_id)
  values ('${govWard}','authority','sentinel') returning id`);
const [{ id: competingRequest }] = await query(`insert into public.authority_ward_assignment_requests(ward_id,authority_id,sentinel_id)
  values ('${govWard}','authority','sentinel2') returning id`);
const [{ id: crossStateRequest }] = await query(`insert into public.authority_ward_assignment_requests(ward_id,authority_id,sentinel_id)
  values ('${govWard}','authority','victim') returning id`);
await actor('sentinel');
await db.query(`select public.respond_authority_ward_assignment_request('${acceptedRequest}',true)`);
assert.equal((await query(`select owner_id from public.ward_listings where id='${govWard}'`))[0].owner_id,'sentinel');
assert.equal((await query(`select status from public.ward_listings where id='${govWard}'`))[0].status,'under_review');
assert.equal((await query(`select status from public.authority_ward_assignment_requests where id='${acceptedRequest}'`))[0].status,'accepted');
await actor('authority','behoerde','Bayern');
assert.equal((await query(`select status from public.authority_ward_assignment_requests where id='${competingRequest}'`))[0].status,'cancelled');
assert.equal((await query(`select status from public.authority_ward_assignment_requests where id='${crossStateRequest}'`))[0].status,'cancelled');
console.log('Authority requests require sentinel consent; decline preserves custody and acceptance transfers atomically');

await actor('new_authority','behoerde');
await denied("insert into public.profiles(id,region) values ('new_authority','Berlin')");
await db.exec("insert into public.profiles(id) values ('new_authority')");
await denied("update public.profiles set region='Berlin' where id='new_authority'");
await actor('ordinary');
await denied("insert into public.sentinel_applications(user_id,case_id,full_name,email,region,experience_years,capacity,motivation,tier) values ('ordinary','ST-BAD','Name','x@example.test','Berlin',1,'1','m','S4')");

await actor('shelter','einrichtung');
await denied(`insert into public.sentinel_shelter_requests(shelter_id,sentinel_id) values ('${shelter}','victim')`);
await actor('sentinel');
await denied(`insert into public.sentinel_shelter_requests(shelter_id,sentinel_id,status) values ('${shelter}','sentinel','accepted')`);
await denied(`insert into public.ward_interest(ward_id,applicant_id,message,status) values ('${ward}','sentinel','m','matched')`);
await db.exec(`insert into public.sentinel_shelter_requests(shelter_id,sentinel_id) values ('${shelter}','sentinel')`);
await denied("update public.sentinel_shelter_requests set status='accepted'");
await actor('shelter','einrichtung');
await denied("update public.sentinel_shelter_requests set sentinel_id='victim'");
await db.exec("update public.sentinel_shelter_requests set status='accepted'");
await actor('sentinel');
await db.exec("update public.sentinel_shelter_requests set sentinel_hidden=true");
assert.equal((await query('select status from public.sentinel_shelter_requests'))[0].status,'accepted');
await db.exec("update public.sentinel_shelter_requests set status='withdrawn'");
await db.exec("update public.sentinel_shelter_requests set status='open', sentinel_hidden=false");
await db.exec(`insert into public.ward_interest(ward_id,applicant_id,message) values ('${ward}','sentinel','m')`);
const [{id: interestId}] = await query('select id from public.ward_interest');
await denied(`select public.match_ward_interest('${interestId}')`);
await actor('unscoped','behoerde');
await denied(`select public.match_ward_interest('${interestId}')`);
await actor('shelter','einrichtung');
await db.exec(`select public.match_ward_interest('${interestId}')`);
assert.equal((await query(`select owner_id from public.ward_listings where id='${ward}'`))[0].owner_id,'sentinel');
await db.exec(`select public.match_ward_interest('${interestId}')`);
// Restore the deletion fixture after proving assignment persisted.
await db.exec(`update public.ward_listings set owner_id='victim' where id='${ward}'`);
await denied("update public.ward_interest set applicant_id='victim'");
console.log('Expert-tier protection and request create/accept/hide/withdraw/reopen protections passed');

await actor('sentinel');
await denied("insert into public.sentinel_change_requests(user_id,requested,status) values ('sentinel','{}','approved')");
const [{id: request}] = await query(`insert into public.sentinel_change_requests(user_id,requested)
  values ('sentinel','{"street":"New Street","house_number":"3","zip":"12345","city":"City"}') returning id`);
await db.exec(`update public.sentinel_change_requests set status='approved' where id='${request}'`);
assert.equal((await query(`select status from public.sentinel_change_requests where id='${request}'`))[0].status,'pending');
await denied(`select public.review_sentinel_change('${request}',true)`);
await actor('admin','admin');
await db.exec(`select public.review_sentinel_change('${request}',true)`);
assert.equal((await query("select pledge_data#>>'{questionnaire,street}' as street from public.sentinel_applications where user_id='sentinel'"))[0].street,'New Street');
await actor('sentinel');
await db.exec(`delete from public.sentinel_change_requests where id='${request}'`);
assert.equal((await query(`select status from public.sentinel_change_requests where id='${request}'`))[0].status,'approved');
await actor('ordinary');
await denied("select public.review_sentinel_application((select id from public.sentinel_applications limit 1),'approved','S4','')");
await actor('admin','admin');
await db.exec(`reset role;
  create function public.test_fail_review() returns trigger language plpgsql as $$ begin raise exception 'injected audit failure'; end $$;
  create trigger test_fail_review before insert on public.application_audit_log for each row execute function public.test_fail_review();`);
await actor('admin','admin');
await assert.rejects(() => db.query("select public.review_sentinel_application(id,'approved','S4','test') from public.sentinel_applications where user_id='pending'"), /injected audit failure/);
assert.equal((await query("select status from public.sentinel_applications where user_id='pending'"))[0].status,'pending');
await db.exec('reset role; drop trigger test_fail_review on public.application_audit_log');
await actor('admin','admin');
await db.exec("select public.review_sentinel_application(id,'approved','S4','Nachweise geprüft') from public.sentinel_applications where user_id='pending'");
assert.equal((await query("select tier from public.sentinel_applications where user_id='pending'"))[0].tier,'S4');
assert.equal((await query("select count(*)::int n from public.application_audit_log where notes like '%Nachweise geprüft%'"))[0].n,1);
console.log('Atomic address review and immutable reviewed request passed');

await denied("select public.delete_account_data('victim')");
await db.exec('reset role');
await db.exec(`insert into public.application_audit_log(application_id,actor_id,action)
  select id,'admin','approved' from public.sentinel_applications where user_id='victim';
  insert into public.change_log(actor_id,action,table_name,record_id) values ('victim','UPDATE','ward_listings','${ward}');
  insert into public.authority_ward_assignment_requests(ward_id,authority_id,sentinel_id) values ('${ward}','victim','sentinel');
  create function public.test_fail_delete() returns trigger language plpgsql as $$ begin raise exception 'injected failure'; end $$;
  create trigger test_fail_delete before delete on public.profiles for each row execute function public.test_fail_delete();
  set role service_role;
`);
await assert.rejects(() => db.query("select public.delete_account_data('victim')"), /injected failure/);
assert.equal((await query("select * from public.sentinel_applications where user_id='victim'")).length,1);
assert.equal((await query("select owner_id from public.ward_listings where id='"+ward+"'"))[0].owner_id,'victim');
assert.equal((await query("select * from public.authority_ward_assignment_requests where authority_id='victim'")).length,1);
assert.equal((await query('select * from public.account_deletion_jobs')).length,0);
await db.exec('reset role; drop trigger test_fail_delete on public.profiles; set role service_role');
await db.exec("select public.delete_account_data('victim')");
await db.exec("select public.delete_account_data('victim')");
assert.equal((await query("select * from public.sentinel_applications where user_id='victim'")).length,0);
assert.equal((await query("select * from public.authority_ward_assignment_requests where authority_id='victim' or sentinel_id='victim'")).length,0);
assert.ok((await query('select application_id from public.application_audit_log where application_id is null')).length > 0);
assert.equal((await query("select count(*)::int n from public.change_log where actor_id='victim'"))[0].n,0);
await denied("update public.change_log set actor_id='attacker'");
console.log('Transactional account deletion, audit retention, restricted command and retry passed');
await db.close();
