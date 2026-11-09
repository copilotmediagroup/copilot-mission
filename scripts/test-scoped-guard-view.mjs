import fs from 'node:fs'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
const ids={admin:'00000000-0000-0000-0000-000000000001',agency:'00000000-0000-0000-0000-000000000002',guard:'00000000-0000-0000-0000-000000000003',client:'00000000-0000-0000-0000-000000000004',otherAgency:'00000000-0000-0000-0000-000000000005',otherGuard:'00000000-0000-0000-0000-000000000006',suspended:'00000000-0000-0000-0000-000000000007'}
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.profiles(id uuid primary key,full_name text,role text,account_status text);
create table public.guards(id uuid primary key,user_id uuid,agency_id uuid,availability text,avatar_url text);
create table public.agencies(id uuid primary key,owner_user_id uuid);
create function public.is_platform_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='platform_admin' and account_status='approved') $$;
create function public.has_agency_access(a uuid,b boolean) returns boolean language sql stable security definer as $$ select exists(select 1 from public.agencies where id=a and owner_user_id=auth.uid()) $$;
alter table public.profiles enable row level security;alter table public.guards enable row level security;
create policy profiles_select_rc1 on public.profiles for select to authenticated using(id=auth.uid() or public.is_platform_admin());
create policy guards_select_rc1 on public.guards for select to authenticated using(user_id=auth.uid() or public.is_platform_admin() or public.has_agency_access(agency_id,false));
grant usage on schema public,auth to anon,authenticated,service_role;grant select on public.profiles,public.guards to authenticated;
create view public.developer_guard_identity as select g.id,g.user_id,g.agency_id,p.full_name as name,g.availability,g.avatar_url from public.guards g left join public.profiles p on p.id=g.user_id;
grant all on public.developer_guard_identity to anon,authenticated,service_role;`)
for(const [role,id] of Object.entries(ids))await db.query('insert into public.profiles values($1,$2,$3,$4)',[id,role,role==='admin'?'platform_admin':role.includes('Agency')||role==='agency'?'agency_admin':role==='client'?'client':'guard',role==='suspended'?'suspended':'approved'])
await db.query('insert into public.agencies values($1,$1),($2,$2)',[ids.agency,ids.otherAgency])
await db.query("insert into public.guards values($1,$1,$2,'available',null),($3,$3,$4,'available',null),($5,$5,$2,'available',null)",[ids.guard,ids.agency,ids.otherGuard,ids.otherAgency,ids.suspended])
const rows=async(id,role='authenticated')=>{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);try{return (await db.query('select * from public.developer_guard_identity order by id')).rows}finally{await db.exec('reset role')}}
await db.exec(fs.readFileSync('supabase/migrations/20261109115144_harden_developer_guard_identity_view.sql','utf8'))
const broken=await rows(ids.agency);assert.ok(broken.length>0);assert.ok(broken.every(x=>x.name===null));console.log('PASS original migration reproduces production preflight failure: Agency Guard names disappear')
await db.exec(fs.readFileSync('supabase/migrations/20261109121945_scoped_guard_identity_view_access.sql','utf8'))
await db.exec('set role anon');await assert.rejects(db.query('select * from public.developer_guard_identity'),/permission denied/);await assert.rejects(db.query('select * from copisec_identity.visible_guard_identities()'),/permission denied/);await db.exec('reset role')
assert.equal((await rows(ids.client)).length,0)
const agency=await rows(ids.agency);assert.equal(agency.length,2);assert.ok(agency.every(x=>x.agency_id===ids.agency&&x.name));
const guard=await rows(ids.guard);assert.equal(guard.length,1);assert.equal(guard[0].user_id,ids.guard);assert.equal(guard[0].name,'guard')
assert.equal((await rows(ids.admin)).length,3)
assert.equal((await rows(ids.suspended)).length,0)
assert.equal((await rows(ids.admin,'service_role')).length,3)
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids.agency]);await db.exec('set role authenticated');assert.equal((await db.query('select * from public.profiles')).rows.length,1,'underlying profiles policy unchanged');await db.exec('reset role')
assert.equal((await db.query('select count(*)::int n from public.guards')).rows[0].n,3)
await db.close()
console.log('PASS replacement proposal: anonymous denied; Client isolation; Agency owned-Guard names; Guard self; Platform Admin; service role; suspended-account denial; no profile-policy widening or record deletion')
