-- Platform admins can review submitted guard credentials through existing RLS.
create policy guard_credentials_platform_read on public.guard_credentials for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='platform_admin'));
create policy guard_credentials_platform_update on public.guard_credentials for update to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='platform_admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='platform_admin'));
