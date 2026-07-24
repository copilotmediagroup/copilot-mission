import type { StateMeta } from './types'

export const states: StateMeta[] = [
  { id: 'offline', number: 1, label: 'Off Duty', short: 'Welcome / Profile', description: 'Guard is offline and available.', accent: '#7d8794' },
  { id: 'waiting', number: 2, label: 'Online', short: 'Waiting', description: 'Guard is online and waiting for assignment.', accent: '#00d87a' },
  { id: 'assignment', number: 3, label: 'New Assignment', short: 'New Job', description: 'New job request received.', accent: '#1685ff' },
  { id: 'enroute', number: 4, label: 'En Route', short: 'En Route', description: 'Guard is on the way to the property.', accent: '#1685ff' },
  { id: 'arrived', number: 5, label: 'Arrived', short: 'Arrived', description: 'Guard has arrived at the property.', accent: '#00d87a' },
  { id: 'patrol', number: 6, label: 'On Patrol', short: 'On Patrol', description: 'Patrol in progress. Complete checkpoints.', accent: '#ff7a00' },
  { id: 'proof', number: 7, label: 'Upload Proof', short: 'Upload Proof', description: 'Patrol complete. Upload proof.', accent: '#b754f6' },
  { id: 'completed', number: 8, label: 'Completed', short: 'Completed', description: 'Assignment complete. Return online.', accent: '#00d87a' },
]
