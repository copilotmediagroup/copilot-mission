-- Marketplace commission: NOW 25%; scheduled and Vacation Watch 20%.
create or replace function public.calculate_job_estimate(p_service_type text,p_priority public.job_priority default 'standard'::public.job_priority,p_duration_minutes integer default 60,p_scheduled_for timestamptz default null,p_requested_start text default 'scheduled',p_vacation_start_date date default null,p_vacation_end_date date default null,p_vacation_checks_per_day integer default null) returns jsonb language plpgsql security definer set search_path to 'public' set row_security to 'off' as $function$
declare v_mode text:=coalesce(nullif(p_requested_start,''),'scheduled'); v_minutes integer:=greatest(coalesce(p_duration_minutes,60),60); v_rate integer; v_total integer; v_fee integer; v_payout integer; v_label text; v_days integer; v_visits integer; v_fee_bps integer;
begin
 if v_mode='vacation' then
  if p_vacation_start_date is null or p_vacation_end_date is null then raise exception 'Vacation start and return dates are required.' using errcode='23514'; end if;
  if p_vacation_end_date<p_vacation_start_date then raise exception 'Vacation return date must be on or after the start date.' using errcode='23514'; end if;
  if coalesce(p_vacation_checks_per_day,0) not between 1 and 3 then raise exception 'Choose 1, 2, or 3 property checks per day.' using errcode='23514'; end if;
  v_days:=(p_vacation_end_date-p_vacation_start_date)+1; if v_days>60 then raise exception 'Vacation Watch can be booked for up to 60 days at a time.' using errcode='23514'; end if;
  v_visits:=v_days*p_vacation_checks_per_day; v_total:=v_visits*3500; v_fee_bps:=2000; v_fee:=ceiling(v_total::numeric*v_fee_bps/10000)::int; v_payout:=v_total-v_fee; v_minutes:=v_visits*30; v_label:='Vacation Watch';
 else
  if p_service_type='armed_guard' then v_rate:=case when v_mode='immediate' then 7000 else 5500 end; v_label:=case when v_mode='immediate' then 'Now armed guard' else 'Scheduled armed guard' end;
  else v_rate:=case when v_mode='immediate' then 5000 else 4000 end; v_label:=case when v_mode='immediate' then 'Now unarmed guard' else 'Scheduled unarmed guard' end; end if;
  v_total:=ceiling(v_rate::numeric*v_minutes/60)::int; v_fee_bps:=case when v_mode='immediate' then 2500 else 2000 end; v_fee:=ceiling(v_total::numeric*v_fee_bps/10000)::int; v_payout:=v_total-v_fee; v_visits:=null;
 end if;
 return jsonb_build_object('service_type',case when v_mode='vacation' then 'mobile_patrol' else p_service_type end,'label',v_label,'request_mode',v_mode,'duration_minutes',v_minutes,'vacation_start_date',p_vacation_start_date,'vacation_end_date',p_vacation_end_date,'vacation_checks_per_day',p_vacation_checks_per_day,'vacation_total_visits',v_visits,'subtotal_cents',v_total,'priority_surcharge_cents',0,'after_hours_surcharge_cents',0,'total_cents',v_total,'platform_fee_cents',v_fee,'agency_payout_cents',v_payout,'platform_fee_bps',v_fee_bps,'payment_status','estimate_only','payout_status','held_until_report');
end $function$;
