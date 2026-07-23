export type MissionState =
  | 'offline'
  | 'waiting'
  | 'assignment'
  | 'enroute'
  | 'arrived'
  | 'patrol'
  | 'proof'
  | 'completed'

export type StateMeta = {
  id: MissionState
  number: number
  label: string
  short: string
  description: string
  accent: string
}

export type PatrolEvidence = {
  checkpoint: number
  photos: number
  videos: number
  note: string
}


export type IncidentSeverity = 'low' | 'medium' | 'high'

export type IncidentRecord = {
  id: string
  checkpoint: number
  type: string
  severity: IncidentSeverity
  note: string
  photos: number
  videos: number
  timestamp: string
  location: string
}

export type SkippedCheckpoint = {
  checkpoint: number
  reason: string
  timestamp: string
}
