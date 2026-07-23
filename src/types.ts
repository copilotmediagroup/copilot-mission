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
