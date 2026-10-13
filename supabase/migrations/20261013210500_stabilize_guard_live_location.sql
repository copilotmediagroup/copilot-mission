-- Keep live guard position monotonic and make mission GPS safe for multi-guard jobs.
create or replace function public.publish_guard_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_heading_degrees double precision default null,
  p_speed_mps double precision default null,
  p_captured_at timestamptz default now(),
  p_job_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_guard public.guards%rowtype;
  v_assignment_status text;
  v_captured_at timestamptz := coalesce(p_captured_at,now());
  v_applied boolean := false;
begin
  if public.current_role()<>'guard' then raise exception 'GUARD_ROLE_REQUIRED'; end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 or p_longitude is null or p_longitude < -180 or p_longitude > 180 then raise exception 'INVALID_COORDINATES'; end if;
  if v_captured_at > now()+interval '2 minutes' or v_captured_at < now()-interval '30 minutes' then raise exception 'INVALID_CAPTURE_TIME'; end if;

  select * into v_guard from public.guards where user_id=auth.uid() for update;
  if v_guard.id is null then raise exception 'GUARD_RECORD_NOT_FOUND'; end if;
  if v_guard.availability='offline' then raise exception 'GUARD_OFFLINE'; end if;

  if p_job_id is not null then
    select ja.status into v_assignment_status
    from public.job_assignments ja
    where ja.job_id=p_job_id and ja.guard_id=v_guard.id
      and ja.status in ('offered','accepted','en_route','arrived','active')
    order by ja.assigned_at desc limit 1;
    if v_assignment_status is null then raise exception 'MISSION_NOT_ASSIGNED_TO_GUARD'; end if;
  end if;

  -- Background/mobile delivery can arrive out of order. Never let an older sample
  -- move the visible guard backwards or make a fresh guard appear stale.
  if v_guard.last_location_at is null or v_captured_at >= v_guard.last_location_at then
    update public.guards set current_latitude=p_latitude,current_longitude=p_longitude,last_location_at=v_captured_at where id=v_guard.id;
    v_applied := true;
  end if;

  insert into public.guard_location_points(guard_id,agency_id,job_id,latitude,longitude,accuracy_meters,heading_degrees,speed_mps,captured_at)
  values(v_guard.id,v_guard.agency_id,p_job_id,p_latitude,p_longitude,p_accuracy_meters,p_heading_degrees,p_speed_mps,v_captured_at);

  return jsonb_build_object('guard_id',v_guard.id,'agency_id',v_guard.agency_id,'job_id',p_job_id,'latitude',p_latitude,'longitude',p_longitude,'accuracy_meters',p_accuracy_meters,'captured_at',v_captured_at,'freshness','live','applied_to_live_position',v_applied);
end $$;
revoke all on function public.publish_guard_location(double precision,double precision,double precision,double precision,double precision,timestamptz,uuid) from public,anon;
grant execute on function public.publish_guard_location(double precision,double precision,double precision,double precision,double precision,timestamptz,uuid) to authenticated,service_role;
