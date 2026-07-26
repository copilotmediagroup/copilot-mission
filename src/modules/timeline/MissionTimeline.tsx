import { useState } from 'react'
import { ChevronDown, Clock3, Radio, ShieldAlert, X } from 'lucide-react'
import { useTimeline } from './useTimeline'
import type { TimelineEntry, TimelineFilter } from './TimelineEngine'

const filters: { id: TimelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mission', label: 'Mission' },
  { id: 'guardian', label: 'Guardian' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'incident', label: 'Incident' },
]

function TimelineItem({ entry }: { entry: TimelineEntry }) {
  const [open, setOpen] = useState(false)
  const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
  return <article className={`timeline-entry source-${entry.source} severity-${entry.severity}`}>
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className="timeline-sequence">#{entry.sequence}</span>
      <span className="timeline-copy"><strong>{entry.title}</strong><small>{entry.detail}</small></span>
      <time>{time}</time>
      <ChevronDown className={open ? 'open' : ''}/>
    </button>
    {open && <div className="timeline-metadata">
      <div><span>Source</span><strong>{entry.source}</strong></div>
      <div><span>Severity</span><strong>{entry.severity}</strong></div>
      <div><span>State</span><strong>{entry.state}</strong></div>
      <div><span>Event</span><strong>{entry.type}</strong></div>
      <div className="metadata-id"><span>Event ID</span><strong>{String(entry.metadata.eventId)}</strong></div>
    </div>}
  </article>
}

export default function MissionTimeline({ className = '', onClose }: { className?: string; onClose?: () => void }) {
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const { entries, total } = useTimeline(filter)

  return <aside className={`mission-timeline-panel ${className}`}>
    <header><div><span className="timeline-live"><Radio/> LIVE ENGINE</span><h2>Mission Timeline</h2><p>Immutable event history for audit, reporting, and playback.</p></div><div className="timeline-head-actions"><div className="timeline-count"><strong>{total}</strong><span>EVENTS</span></div>{onClose && <button className="timeline-close" onClick={onClose} aria-label="Close mission timeline"><X/></button>}</div></header>
    <nav>{filters.map((item) => <button key={item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.label}</button>)}</nav>
    <div className="timeline-feed">
      {entries.length ? entries.map((entry) => <TimelineItem key={entry.id} entry={entry}/>) : <div className="timeline-empty"><Clock3/><strong>Waiting for mission activity</strong><span>Every Mission and Guardian event will be recorded here automatically.</span></div>}
    </div>
    <footer><ShieldAlert/><span>Sequence protected · newest event first</span></footer>
  </aside>
}
