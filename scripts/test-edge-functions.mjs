import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const keys = await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk = {...await webcrypto.subtle.exportKey('jwk',keys.publicKey),kid:'test-key'};
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const data = `${encode({alg:'RS256',kid:'test-key'})}.${encode({sub:'user_test',iss:'https://clerk.test',exp:Math.floor(Date.now()/1000)+300})}`;
const signature = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(data));
const token = `${data}.${Buffer.from(signature).toString('base64url')}`;
const env = {SUPABASE_URL:'https://supabase.test',SUPABASE_SERVICE_ROLE_KEY:'test-service',CLERK_DOMAIN:'clerk.test',CLERK_SECRET_KEY:'test-clerk',BREVO_API_KEY:'test-email',CRON_SECRET:'test-cron'};
const json = (value,status=200) => Response.json(value,{status});
function load(name,fetcher) {
  let handler;
  const source=fs.readFileSync(new URL(`../external-supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  vm.runInNewContext(code, {Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},fetch:fetcher,
    crypto:webcrypto,Request,Response,Headers,File,FormData,Blob,AbortSignal,TextEncoder,Uint8Array,atob,
    console:{log(){},warn(){},error(){}}});
  return handler;
}
const payload={fullName:'Test Person',region:'Berlin',yearsKeeping:5,species:'Python',capacity:'1',quarantine:'yes',vetContact:'Vet',motivation:'A sufficiently long motivation for a real application test.',
  questionnaire:{street:'Street',house_number:'1',zip:'12345',city:'City',phone:'1234567',birth_date:'1990-01-01',
    enclosure:{size:'100',lighting:'UV',climate:'warm',setup:'plants'},enclosures:[],current_stock:'',feeding:'insects',overwintering:'',info_sources:['BNA'],sachkunde:'none',sachkunde_detail:''},
  commitments:{no_trade:true,temporary:true,animal_first:true,transparency:true,handover:true,truthful:true},selfPledge:true};
function submission() {
  const form=new FormData();form.set('payload',JSON.stringify(payload));
  for(const slot of ['id_front','id_back','selfie']) form.set(slot,new File([new Uint8Array([0xff,0xd8,0xff,0])],'photo.jpg',{type:'image/jpeg'}));
  return new Request('https://edge.test/submit',{method:'POST',headers:{authorization:`Bearer ${token}`},body:form});
}
for(const providerStatus of [200,503]) {
  const calls=[];
  const handler=load('submit-sentinel-application',async (input,init={})=>{
    const url=String(input);const method=init.method??'GET';calls.push({url,method,body:init.body});
    if(url.includes('jwks.json')) return json({keys:[jwk]});
    if(url.startsWith('https://api.clerk.com')) return json({primary_email_address_id:'email1',email_addresses:[{id:'email1',email_address:'verified@example.test'}]});
    if(url.includes('api.brevo.com')) return json({},providerStatus);
    if(url.includes('sentinel_applications') && method==='GET') return json([]);
    if(url.includes('sentinel_applications') && method==='POST') return json([{id:'10000000-0000-0000-0000-000000000001',case_id:'ST-TEST'}]);
    return json({});
  });
  const result=await handler(submission());
  assert.equal(result.status,200,await result.text());
  assert.equal(calls.filter(c=>c.method==='DELETE').length,0,'email failure must never remove saved data');
  const states=calls.filter(c=>c.method==='PATCH').map(c=>JSON.parse(c.body).confirmation_status);
  assert.deepEqual(states,providerStatus===200?['pending','sent']:['pending']);
  const email=JSON.parse(calls.find(c=>c.url.includes('api.brevo.com')).body);
  assert.equal(email.to[0].email,'verified@example.test');
}
console.log('Submission commits despite email outage; verified recipient and durable retry state passed');

for(const failDatabase of [true,false]) {
  const calls=[];
  const handler=load('delete-account',async(input,init={})=>{
    const url=String(input);calls.push({url,method:init.method??'GET',body:init.body});
    if(url.includes('jwks.json')) return json({keys:[jwk]});
    if(url.includes('/rpc/delete_account_data')) return json('database_deleted',failDatabase?500:200);
    if(url.includes('/object/list/')) {
      const {prefix}=JSON.parse(init.body);
      if(url.includes('kyc-documents') && prefix==='user_test/') return json([{name:'app',id:null}]);
      if(url.includes('kyc-documents') && prefix==='user_test/app/') return json([{name:'nested',id:null}]);
      if(url.includes('kyc-documents') && prefix==='user_test/app/nested/') return json([{name:'id.jpg',id:'object'}]);
      return json([]);
    }
    return json({});
  });
  const result=await handler(new Request('https://edge.test/delete',{method:'POST',headers:{authorization:`Bearer ${token}`}}));
  assert.equal(result.status,failDatabase?502:200);
  if(failDatabase) assert.equal(calls.filter(c=>c.url.includes('/storage/')||c.url.includes('api.clerk.com')).length,0);
  else {
    const purge=calls.find(c=>c.method==='DELETE'&&c.url.includes('/storage/'));
    assert.deepEqual(JSON.parse(purge.body).prefixes,['user_test/app/nested/id.jpg']);
    const stages=calls.filter(c=>c.method==='PATCH').map(c=>JSON.parse(c.body).stage);
    assert.deepEqual(stages,['storage_deleted','complete']);
    assert.ok(calls.findIndex(c=>c.url.includes('/rpc/'))<calls.findIndex(c=>c.url.includes('/storage/')));
  }
}
console.log('Deletion preflight, recursive storage cleanup and completion stages passed');

for (const mode of ['delivered', 'provider-failed', 'already-claimed']) {
  const calls=[];
  const worker=load('retry-application-confirmations',async(input,init={})=>{
    const url=String(input); calls.push({url,method:init.method??'GET',body:init.body});
    if(url.includes('/rest/')&&!init.method) return json([{id:'app',email:'verified@example.test',full_name:'Test',case_id:'ST-TEST'}]);
    if(init.method==='PATCH' && JSON.parse(init.body).confirmation_next_attempt_at) return json(mode==='already-claimed'?[]:[{id:'app'}]);
    if(url.includes('api.brevo.com')) return json({},mode==='provider-failed'?503:200);
    return json({});
  });
  assert.equal((await worker(new Request('https://edge.test/retry',{method:'POST'}))).status,401);
  assert.equal(calls.length,0);
  const retried=await worker(new Request('https://edge.test/retry',{method:'POST',headers:{authorization:'Bearer test-cron'}}));
  assert.equal(retried.status,200);
  assert.equal((await retried.json()).sent,mode==='delivered'?1:0);
  const claim=calls.find(c=>c.method==='PATCH'&&JSON.parse(c.body).confirmation_next_attempt_at);
  assert.match(claim.url,/confirmation_status=eq.pending&confirmation_next_attempt_at=lte\./);
  assert.ok(new Date(JSON.parse(claim.body).confirmation_next_attempt_at).getTime()>Date.now()+14*60_000);
  assert.equal(calls.filter(c=>c.url.includes('api.brevo.com')).length,mode==='already-claimed'?0:1);
  assert.equal(calls.filter(c=>c.method==='PATCH'&&JSON.parse(c.body).confirmation_status==='sent').length,mode==='delivered'?1:0);
}
console.log('Scheduled retry authentication, successful delivery, provider failure and concurrent-claim protection passed');
