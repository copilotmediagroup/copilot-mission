import type { GuardianState } from '../guardian/types'
import type { MissionEvent } from '../mission/MissionEngine'

export type GuardianEventType =
  | 'GUARDIAN_MONITORING'
  | 'GUARDIAN_ALERT'
  | 'GUARDIAN_ACKNOWLEDGED'
  | 'GUARDIAN_BACKUP_ENROUTE'
  | 'GUARDIAN_RESOLVED'
  | 'GUARDIAN_RESET'

export type GuardianEvent = {
  id: string
  type: GuardianEventType
  timestamp: number
  state: GuardianState
  silent?: boolean
}

export type SystemEvent =
  | { channel: 'mission'; payload: MissionEvent }
  | { channel: 'guardian'; payload: GuardianEvent }

export type EventChannel = SystemEvent['channel'] | '*'
export type EventListener = (event: SystemEvent) => void

class CoPilotEventBus {
  private listeners = new Map<EventChannel, Set<EventListener>>()
  private history: SystemEvent[] = []

  publish(event: SystemEvent) {
    this.history = [event, ...this.history].slice(0, 100)
    this.listeners.get(event.channel)?.forEach((listener) => listener(event))
    this.listeners.get('*')?.forEach((listener) => listener(event))
  }

  subscribe(channel: EventChannel, listener: EventListener) {
    const channelListeners = this.listeners.get(channel) ?? new Set<EventListener>()
    channelListeners.add(listener)
    this.listeners.set(channel, channelListeners)

    return () => {
      channelListeners.delete(listener)
      if (channelListeners.size === 0) this.listeners.delete(channel)
    }
  }

  getHistory(channel: EventChannel = '*') {
    if (channel === '*') return [...this.history]
    return this.history.filter((event) => event.channel === channel)
  }

  clearHistory() {
    this.history = []
  }
}

export const eventBus = new CoPilotEventBus()

export function createGuardianEvent(
  type: GuardianEventType,
  state: GuardianState,
  silent?: boolean,
): GuardianEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: Date.now(),
    state,
    silent,
  }
}
