import fs from 'node:fs'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {PGlite} from '@electric-sql/pglite'
const dir='docs/security/20261109-replacement-preflight'
const snapshot=JSON.parse(fs.readFileSync(dir+'/production-before.json','utf8'))
const sql=fs.readFileSync('supabase/migrations/20261109121945_scoped_guard_identity_view_access.sql','utf8')
const db=new PGlite();const results=[]
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0')
const u={admin:id(1),agency:id(2),guard:id(3),client:id(4),otherAgency:id(5),otherGuard:id(6),suspended:id(7),staffGuard:id(8),suspendedAdmin:id(9)}
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
revoke create on schema public from public;grant usage on schema public,auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create type public.agency_status as enum('approved','pending','suspended');
create table public.profiles(id uuid primary key,full_name text,role text,account_status text,phone text,private_note text);
create table public.guards(id uuid primary key,user_id uuid,agency_id uuid,availability text,avatar_url text);
create table public.agencies(id uuid primary key,owner_user_id uuid,status public.agency_status);
create table public.agency_members(agency_id uuid,user_id uuid,role text,is_active boolean);
grant select on all tables in schema public to authenticated;
`)
for(const helper of snapshot.helper_functions)await db.exec(helper.definition)
for(const table of ['profiles','guards','agencies','agency_members'])await db.exec('alter table public.'+table+' enable row level security')
for(const policy of snapshot.policies){const q='create policy '+policy.policyname+' on public.'+policy.tablename+' for '+policy.cmd+' to '+policy.roles.join(',')+' using('+policy.qual+')';await db.exec(q)}
for(const [name,userId] of Object.entries(u))await db.query('insert into public.profiles values($1,$2,$3,$4,$5,$6)',[userId,name,name==='admin'||name==='suspendedAdmin'?'platform_admin':name==='agency'||name==='otherAgency'?'agency_admin':name==='client'?'client':'guard',name.startsWith('suspended')?'suspended':'approved','PRIVATE_PHONE','PRIVATE_NOTE'])
await db.query("insert into public.agencies values($1,$1,'approved'),($2,$2,'approved')",[u.agency,u.otherAgency])
await db.query('insert into public.agency_members values($1,$1,\'agency_admin\',true),($2,$2,\'agency_admin\',true)',[u.agency,u.otherAgency])
for(const [user,agency] of [[u.guard,u.agency],[u.otherGuard,u.otherAgency],[u.staffGuard,u.agency],[u.suspended,u.agency]])await db.query("insert into public.guards values($1,$1,$2,'available','https://test.invalid/avatar.png')",[user,agency])
await db.exec('create view public.developer_guard_identity as '+snapshot.view.definition+';grant all on public.developer_guard_identity to anon,authenticated,service_role')
const digest=async()=>crypto.createHash('sha256').update(JSON.stringify((await db.query("select (select jsonb_agg(to_jsonb(p) order by id) from public.profiles p) as profiles,(select jsonb_agg(to_jsonb(g) order by id) from public.guards g) as guards,(select jsonb_agg(to_jsonb(a) order by id) from public.agencies a) as agencies,(select jsonb_agg(to_jsonb(m) order by user_id,agency_id) from public.agency_members m) as members")).rows)).digest('hex')
const catalogBefore=(await db.query("select pg_get_viewdef(oid,true) as definition,relacl::text as acl,reloptions as options from pg_class where oid='public.developer_guard_identity'::regclass")).rows[0];const before=await digest();await db.exec(sql);assert.equal(await digest(),before)
async function asUser(user,role='authenticated',extraClaims={}){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,role:'authenticated',...extraClaims})]);await db.exec('set role '+role);try{return (await db.query('select * from public.developer_guard_identity order by id')).rows}finally{await db.exec('reset role')}}
async function check(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS',name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,':',e.message)}}
await check('Agency owns only its Guard identities and retains names',async()=>{const rows=await asUser(u.agency);assert.equal(rows.length,3);assert.ok(rows.every(x=>x.agency_id===u.agency&&x.name));assert.deepEqual(Object.keys(rows[0]).sort(),['id','user_id','agency_id','name','availability','avatar_url'].sort())})
await check('Unrelated Agency cannot see the first Agency roster',async()=>{const rows=await asUser(u.otherAgency);assert.equal(rows.length,1);assert.equal(rows[0].user_id,u.otherGuard)})
await check('Guard self-access and approved Platform Admin access',async()=>{assert.equal((await asUser(u.guard)).length,1);assert.equal((await asUser(u.guard))[0].name,'guard');assert.equal((await asUser(u.admin)).length,4)})
await check('Anonymous view and direct function calls denied',async()=>{await db.exec('set role anon');try{await assert.rejects(db.query('select * from public.developer_guard_identity'),/permission denied/);await assert.rejects(db.query('select * from copisec_identity.visible_guard_identities()'),/permission denied/)}finally{await db.exec('reset role')}})
await check('Clients and suspended Guard/Admin denied',async()=>{for(const user of [u.client,u.suspended,u.suspendedAdmin])assert.equal((await asUser(user)).length,0)})
await check('JWT role and user-metadata spoofing cannot elevate Client',async()=>{assert.equal((await asUser(u.client,'authenticated',{role:'service_role',user_metadata:{role:'platform_admin'}})).length,0)})
await check('Temporary profile and Guard tables cannot hijack name resolution',async()=>{await db.exec("create temporary table profiles(id uuid,full_name text,role text,account_status text);create temporary table guards(id uuid,user_id uuid,agency_id uuid,availability text,avatar_url text)");assert.equal((await asUser(u.guard))[0].name,'guard');await db.exec('drop table pg_temp.profiles,pg_temp.guards')})
await check('Inactive Agency membership never grants access',async()=>{await db.query("insert into public.agency_members values($1,$2,'agency_admin',false)",[u.agency,u.client]);assert.equal((await asUser(u.client)).length,0);await db.query('delete from public.agency_members where user_id=$1',[u.client])})
await check('Client with erroneous active Agency membership still cannot read Guard identities',async()=>{await db.query("insert into public.agency_members values($1,$2,'agency_admin',true)",[u.agency,u.client]);try{assert.equal((await asUser(u.client)).length,0)}finally{await db.query('delete from public.agency_members where user_id=$1',[u.client])}})
await check('Guard with Agency staff membership remains limited to self',async()=>{await db.query("insert into public.agency_members values($1,$2,'agency_staff',true)",[u.agency,u.staffGuard]);try{const rows=await asUser(u.staffGuard);assert.equal(rows.length,1);assert.equal(rows[0].user_id,u.staffGuard)}finally{await db.query('delete from public.agency_members where user_id=$1',[u.staffGuard])}})
await check('Authorized identity results never include private profile fields',async()=>{const rows=await asUser(u.admin);assert.ok(!JSON.stringify(rows).includes('PRIVATE_'));assert.ok(rows.every(x=>!('phone' in x)&&!('private_note' in x)))})
await check('Service database role retains backend read access',async()=>{assert.equal((await asUser('', 'service_role')).length,4)})
await check('Underlying profile RLS remains unchanged',async()=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u.agency]);await db.exec('set role authenticated');try{assert.equal((await db.query('select * from public.profiles')).rows.length,1)}finally{await db.exec('reset role')}})
// Full replacement rollback includes the newly introduced function and schema.
const rollback=fs.readFileSync(dir+'/rollback.sql','utf8')
await check('Rollback restores original view definition, ACL/options and removes only introduced objects',async()=>{const data=await digest();await db.exec(rollback);assert.equal(await digest(),data);assert.deepEqual((await db.query("select pg_get_viewdef(oid,true) as definition,relacl::text as acl,reloptions as options from pg_class where oid='public.developer_guard_identity'::regclass")).rows[0],catalogBefore);assert.equal((await db.query("select reloptions from pg_class where oid='public.developer_guard_identity'::regclass")).rows[0].reloptions,null);assert.equal((await db.query("select has_table_privilege('anon','public.developer_guard_identity','select') as allowed")).rows[0].allowed,true);assert.equal((await db.query("select to_regnamespace('copisec_identity') as schema")).rows[0].schema,null)})
await check('Authenticated database role cannot become service_role',async()=>{await db.exec('set session authorization authenticated');try{await assert.rejects(db.exec('set role service_role'),/permission denied/)}finally{await db.exec('reset session authorization;reset role')}})
await db.close();const failed=results.filter(x=>!x.pass)
fs.writeFileSync(dir+'/isolated-preflight-results.json',JSON.stringify({migrationSha256:crypto.createHash('sha256').update(sql).digest('hex'),productionChanged:false,checks:results,passed:results.length-failed.length,failed:failed.length},null,2))
if(failed.length)process.exitCode=1
console.log('Preflight tests:',results.length-failed.length,'passed;',failed.length,'failed')
