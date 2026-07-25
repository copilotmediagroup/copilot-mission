import { useEffect, useMemo, useState } from 'react'
import { timelineEngine, type TimelineFilter } from './TimelineEngine'

export function useTimeline(filter: TimelineFilter = 'all') {
  const [entries, setEntries] = useState(() => timelineEngine.getEntries())

  useEffect(() => timelineEngine.subscribe(setEntries), [])

  return useMemo(() => ({
    entries: filter === 'all' ? entries : entries.filter((entry) => entry.source === filter),
    total: entries.length,
    clear: () => timelineEngine.clear(),
  }), [entries, filter])
}
