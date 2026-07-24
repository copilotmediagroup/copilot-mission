export type GuardianState = 'idle' | 'monitoring' | 'alert' | 'acknowledged' | 'backup_enroute' | 'resolved'

export type GuardianSignal = {
  id: string
  label: string
  detail: string
  status: 'normal' | 'warning' | 'critical'
}
