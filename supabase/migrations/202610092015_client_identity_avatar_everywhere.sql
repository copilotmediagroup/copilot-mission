-- Client identity image propagation. profiles.avatar_url is the single source of truth.
create or replace function public.get_visible_client_identities()
returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$
declare v_role public.app_role; v_agency uuid; v_guard uuid; v_client uuid;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if v_role='agency_admin' then select agency_id into v_agency from public.resolve_my_agency_workspace() limit 1;
 elsif v_role='guard' then select id into v_guard from public.guards where user_id=auth.uid() limit 1;
 elsif v_role='client' then select id into v_client from public.clients where user_id=auth.uid() limit 1;
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('client_id',c.id,'user_id',c.user_id,'display_name',c.display_name,'avatar_url',p.avatar_url))
  from public.clients c join public.profiles p on p.id=c.user_id
  where v_role='platform_admin'
   or (v_role='client' and c.id=v_client)
   or (v_role='agency_admin' and exists(select 1 from public.marketplace_jobs j where j.client_id=c.id and ((j.status='open' and j.payment_status in ('authorized','captured')) or j.accepted_agency_id=v_agency)))
   or (v_role='guard' and exists(select 1 from public.marketplace_jobs j join public.job_assignments ja on ja.job_id=j.id where j.client_id=c.id and ja.guard_id=v_guard and ja.status not in ('completed','cancelled')))
 ),'[]'::jsonb);
end $$;
revoke all on function public.get_visible_client_identities() from public;
grant execute on function public.get_visible_client_identities() to authenticated;

create or replace function public.get_owner_client_governance() returns jsonb language plpgsql security definer set search_path=public set row_security=off as $$ begin if public.current_role()<>'platform_admin'::public.app_role then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if; return jsonb_build_object('clients',coalesce((select jsonb_agg(x order by x.created_at desc) from (select c.id client_id,c.user_id,c.display_name,p.full_name,p.phone,p.avatar_url,p.account_status,c.verification_status,c.risk_level,c.risk_note,c.created_at,(select count(*) from public.properties pr where pr.client_id=c.id and pr.archived_at is null) property_count,(select count(*) from public.marketplace_jobs j where j.client_id=c.id) job_count,(select count(*) from public.marketplace_jobs j where j.client_id=c.id and j.status in ('open','accepted','assigned','active')) active_job_count,coalesce((select sum(coalesce(j.estimated_total_cents,0)) from public.marketplace_jobs j where j.client_id=c.id and j.status='completed'),0) lifetime_spend_cents,coalesce((select jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.name,'address',pr.address)) from public.properties pr where pr.client_id=c.id and pr.archived_at is null),'[]'::jsonb) properties,coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'title',j.title,'status',j.status,'payment_status',j.payment_status,'estimated_total_cents',j.estimated_total_cents) order by j.created_at desc) from public.marketplace_jobs j where j.client_id=c.id),'[]'::jsonb) jobs from public.clients c join public.profiles p on p.id=c.user_id where p.role='client')x),'[]'::jsonb)); end $$;
revoke all on function public.get_owner_client_governance() from public;
grant execute on function public.get_owner_client_governance() to authenticated;
