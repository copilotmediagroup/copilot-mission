// Run with PGLITE_MODULE pointing to an isolated @electric-sql/pglite installation.
import fs from 'node:fs'
import assert from 'node:assert/strict'
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite')
const db=new PGlite()
await db.exec(`create role anon;create role authenticated;create role service_role;
create table public.guards(id uuid primary key,user_id uuid,agency_id uuid,availability text,avatar_url text);
create table public.profiles(id uuid primary key,full_name text);
alter table public.guards enable row level security;alter table public.profiles enable row level security;
grant usage on schema public to anon,authenticated;grant select on public.guards,public.profiles to authenticated;
insert into public.guards values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',null,'available',null);
insert into public.profiles values('00000000-0000-0000-0000-000000000002','Private Guard');
create view public.developer_guard_identity as select g.id,g.user_id,g.agency_id,p.full_name as name,g.availability,g.avatar_url from public.guards g left join public.profiles p on p.id=g.user_id;
grant all on public.developer_guard_identity to anon,authenticated;
set role anon;`)
assert.equal((await db.query('select * from public.developer_guard_identity')).rows.length,1,'reproduce anonymous view bypass')
await db.exec('reset role')
const sql=fs.readFileSync('supabase/migrations/20261109115144_harden_developer_guard_identity_view.sql','utf8')
await db.exec(sql)
await db.exec('set role anon')
await assert.rejects(db.query('select * from public.developer_guard_identity'),/permission denied/)
await db.exec('reset role;set role authenticated')
assert.equal((await db.query('select * from public.developer_guard_identity')).rows.length,0,'underlying RLS must apply')
await db.exec('reset role;create policy guard_read on public.guards for select to authenticated using(true);create policy profile_read on public.profiles for select to authenticated using(true);set role authenticated')
assert.equal((await db.query('select * from public.developer_guard_identity')).rows.length,1,'authorized reads preserved')
await db.exec('reset role')
assert.equal((await db.query('select count(*)::integer n from public.guards')).rows[0].n,1,'no records deleted')
await db.exec(sql)
await db.close()
console.log('PASS identity view migration: reproduced leak, denied anonymous access, enforced RLS, preserved authorized reads and records, repeat application safe')
