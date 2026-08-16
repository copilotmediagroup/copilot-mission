import { supabase } from '../../lib/supabase'
import type {
  MissionRuntime,
  MissionRuntimeFreshness,
} from './MissionRuntime'
import {
  normalizeMissionRuntimeState,
} from './missionRuntimeState'
import {
  validateMissionRuntime,
} from './missionRuntimeValidation'

type JsonRecord = Record<string, unknown>

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }
  return supabase
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0
    ? value
    : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null
}

function freshness(
  updatedAt: string | null
): MissionRuntimeFreshness {
  if (!updatedAt) return 'none'

  const timestamp = new Date(updatedAt).getTime()
  if (!Number.isFinite(timestamp)) return 'none'

  const age = Date.now() - timestamp

  if (age <= 60_000) return 'live'
  if (age <= 5 * 60_000) return 'stale'

  return 'expired'
}

function record(
  value: unknown
): JsonRecord | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord
  }

  return null
}

function firstRecord(
  value: unknown
): JsonRecord | null {
  if (Array.isArray(value)) {
    return record(value[0])
  }

  return record(value)
}

/*
 * ============================================================
 * CANONICAL RUNTIME READ
 * ============================================================
 *
 * marketplace_jobs.id is the canonical mission identity.
 *
 * This repository is the ONLY frontend layer that should
 * eventually assemble:
 *
 * job
 *   + assignment
 *   + mission engine state
 *   + agency
 *   + guard
 *   + property
 *   + live guard GPS
 *   + timeline
 *
 * Screens consume MissionRuntime.
 * Screens do NOT reconstruct mission truth themselves.
 * ============================================================
 */

export async function getMissionRuntime(
  jobId: string
): Promise<MissionRuntime> {
  const db = requireSupabase()

  const { data, error } = await db.rpc(
    'get_mission_runtime_v2',
    {
      p_job_id: jobId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(`MISSION_RUNTIME_NOT_FOUND:${jobId}`)
  }

  const runtime = data as unknown as MissionRuntime

  const validation = validateMissionRuntime(runtime)

  if (!validation.valid) {
    console.warn(
      '[MissionRuntime] validation issues',
      validation.issues
    )
  }

  return runtime
}

/*
 * ============================================================
 * REALTIME INVALIDATION
 *
 * Realtime remains an invalidation mechanism only.
 *
 * A canonical database change causes the screen to call
 * getMissionRuntime() again, which now reads mission truth
 * exclusively through get_mission_runtime_v2.
 * ============================================================
 */

export function subscribeToMissionRuntime(
  jobId: string,
  onChange: () => void
) {
  if (!supabase) {
    return () => undefined
  }

  const db = supabase

  const channel = db
    .channel(
      `mission-runtime-${jobId}-${crypto.randomUUID()}`
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'marketplace_jobs',
        filter: `id=eq.${jobId}`,
      },
      onChange
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'job_assignments',
        filter: `job_id=eq.${jobId}`,
      },
      onChange
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'mission_engine_state',
        filter: `job_id=eq.${jobId}`,
      },
      onChange
    )

    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'mission_events',
        filter: `job_id=eq.${jobId}`,
      },
      onChange
    )

    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'guards',
      },
      payload => {
        const changedGuard =
          record(payload.new) ??
          record(payload.old)

        if (!changedGuard) return

        /*
         * Guard filtering is intentionally resolved by
         * re-reading runtime. This keeps the repository
         * correct even if assignment changes guards.
         */
        void changedGuard
        onChange()
      }
    )

    .subscribe()

  return () => {
    void db.removeChannel(channel)
  }
}
