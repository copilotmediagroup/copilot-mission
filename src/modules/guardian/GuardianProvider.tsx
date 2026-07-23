import { useMemo, useState, type ReactNode } from 'react'
import type { MissionState } from '../../types'
import { GuardianContext } from './GuardianContext'
import type { GuardianSignal, GuardianState } from './types'

export function GuardianProvider({ missionState, children }: { missionState: MissionState; children: ReactNode }) {
  const activeMission = ['enroute','arrived','patrol','proof'].includes(missionState)
  const [override, setOverride] = useState<GuardianState | null>(null)
  const [silentMode, setSilentMode] = useState(false)
  const state: GuardianState = override ?? (activeMission ? 'monitoring' : 'idle')

  const signals = useMemo<GuardianSignal[]>(() => [
    { id:'gps', label:'GPS', detail: activeMission ? 'Live location connected' : 'Starts with mission', status:'normal' },
    { id:'network', label:'Network', detail:'Secure agency channel', status:'normal' },
    { id:'battery', label:'Battery', detail:'Device level normal', status:'normal' },
    { id:'checkin', label:'Check-in', detail: activeMission ? 'Mission activity detected' : 'Not monitoring', status:'normal' },
  ], [activeMission])

  return <GuardianContext.Provider value={{
    state,
    silentMode,
    signals,
    triggerAlert:(silent=false)=>{ setSilentMode(silent); setOverride('alert') },
    acknowledge:()=>setOverride('acknowledged'),
    dispatchBackup:()=>setOverride('backup_enroute'),
    resolve:()=>setOverride('resolved'),
    reset:()=>{ setSilentMode(false); setOverride(null) },
  }}>{children}</GuardianContext.Provider>
}
