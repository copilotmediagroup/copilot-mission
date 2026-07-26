import { createContext, useContext } from 'react'
import type { GuardianSignal, GuardianState } from './types'

export type GuardianContextValue = {
  state: GuardianState
  silentMode: boolean
  signals: GuardianSignal[]
  triggerAlert: (silent?: boolean) => void
  acknowledge: () => void
  dispatchBackup: () => void
  resolve: () => void
  reset: () => void
}

export const GuardianContext = createContext<GuardianContextValue | null>(null)

export function useGuardian() {
  const value = useContext(GuardianContext)
  if (!value) throw new Error('useGuardian must be used inside GuardianProvider')
  return value
}
