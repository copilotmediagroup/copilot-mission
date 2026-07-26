import { useEffect, useState } from 'react'
import { eventBus, type EventChannel, type SystemEvent } from './EventBus'

export function useEventBus(channel: EventChannel = '*') {
  const [latestEvent, setLatestEvent] = useState<SystemEvent | null>(null)

  useEffect(() => eventBus.subscribe(channel, setLatestEvent), [channel])

  return {
    latestEvent,
    history: eventBus.getHistory(channel),
    publish: eventBus.publish.bind(eventBus),
  }
}
