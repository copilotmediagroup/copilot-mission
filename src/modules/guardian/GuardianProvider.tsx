import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MissionState } from '../../types'
import { createGuardianEvent, eventBus, type GuardianEventType } from '../events/EventBus'
import { GuardianContext } from './GuardianContext'
import type { GuardianSignal, GuardianState } from './types'

export function GuardianProvider({ missionState, children }: { missionState: MissionState; children: ReactNode }) {
  const activeMission = ['enroute','arrived','patrol','proof'].includes(missionState)
  const [override, setOverride] = useState<GuardianState | null>(null)
  const [silentMode, setSilentMode] = useState(false)
  const state: GuardianState = override ?? (activeMission ? 'monitoring' : 'idle')

  const publishGuardian = useCallback((type: GuardianEventType, nextState: GuardianState, silent?: boolean) => {
    eventBus.publish({ channel: 'guardian', payload: createGuardianEvent(type, nextState, silent) })
  }, [])

  useEffect(() => {
    if (activeMission && !override) publishGuardian('GUARDIAN_MONITORING', 'monitoring')
  }, [activeMission, override, publishGuardian])

  useEffect(() => eventBus.subscribe('mission', (event) => {
    if (event.channel !== 'mission') return
    if (event.payload.type === 'MISSION_COMPLETED' || event.payload.type === 'MISSION_RESET') {
      setSilentMode(false)
      setOverride(null)
      publishGuardian('GUARDIAN_RESET', 'idle')
    }
  }), [publishGuardian])

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
    triggerAlert:(silent=false)=>{
      setSilentMode(silent)
      setOverride('alert')
      publishGuardian('GUARDIAN_ALERT', 'alert', silent)
    },
    acknowledge:()=>{
      setOverride('acknowledged')
      publishGuardian('GUARDIAN_ACKNOWLEDGED', 'acknowledged')
    },
    dispatchBackup:()=>{
      setOverride('backup_enroute')
      publishGuardian('GUARDIAN_BACKUP_ENROUTE', 'backup_enroute')
    },
    resolve:()=>{
      setOverride('resolved')
      publishGuardian('GUARDIAN_RESOLVED', 'resolved')
    },
    reset:()=>{
      setSilentMode(false)
      setOverride(null)
      publishGuardian('GUARDIAN_RESET', activeMission ? 'monitoring' : 'idle')
    },
  }}>{children}</GuardianContext.Provider>
}
