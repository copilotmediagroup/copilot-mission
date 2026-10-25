-- RC35: real photo proof is a database invariant for required checkpoints.
-- Applies equally to single-guard, multi-guard, production, and Live Account Test runtimes.
create or replace function public.enforce_mission_real_photo_checkpoint_rc1() returns trigger language plpgsql security definer set search_path=public set row_security=off as $$ begin
 if old.checkpoint_index in(2,4) and new.checkpoint_index=old.checkpoint_index+1 then
  if new.guard_id is null or not exists(select 1 from public.mission_evidence_media m where m.job_id=new.job_id and m.guard_id=new.guard_id and m.checkpoint_index=old.checkpoint_index and m.kind='photo') then
   raise exception 'REQUIRED_REAL_PHOTO_MISSING' using errcode='22023';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists mission_engine_real_photo_checkpoint on public.mission_engine_state;
create trigger mission_engine_real_photo_checkpoint before update on public.mission_engine_state for each row execute function public.enforce_mission_real_photo_checkpoint_rc1();
drop trigger if exists guard_slot_real_photo_checkpoint on public.guard_slot_mission_state;
create trigger guard_slot_real_photo_checkpoint before update on public.guard_slot_mission_state for each row execute function public.enforce_mission_real_photo_checkpoint_rc1();
