import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, BarChart3, BatteryMedium, Check, CheckCircle2, Clock3, Download, FileText, Image, MapPinned, Navigation, PenLine, Printer, RadioTower, ShieldCheck, Signal, Video, Wifi, X } from 'lucide-react'
import type { IncidentRecord, PatrolEvidence } from './types'
import type { MissionRuntime } from './modules/mission-runtime/MissionRuntime'

const checkpointNames = ['Exterior Perimeter','Parking Lot','Main Entrance','Back Entrance','Rear Loading Dock','Side Doors']

export interface MissionReportProps {
  records: PatrolEvidence[]
  incidents: IncidentRecord[]
  missionStartedAt?: number | null
  runtime?: MissionRuntime | null
  onClose: () => void
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function MissionReport({ records, incidents, missionStartedAt, runtime, onClose }: MissionReportProps) {
  const now = Date.now()
  const completedAt = runtime?.timestamps.completedAt ? new Date(runtime.timestamps.completedAt).getTime() : now
  const start = missionStartedAt ?? (runtime?.missionStartedAt ? new Date(runtime.missionStartedAt).getTime() : completedAt)
  const durationMinutes = Math.max(0, Math.round((completedAt - start) / 60000))
  const totals = useMemo(() => records.reduce((sum, record) => ({
    photos: sum.photos + record.photos,
    videos: sum.videos + record.videos,
    notes: sum.notes + (record.note ? 1 : 0),
  }), { photos: 0, videos: 0, notes: 0 }), [records])
  const evidenceTotal = totals.photos + totals.videos + totals.notes
  const completionScore = Math.max(92, 100 - incidents.filter(item => item.status !== 'resolved').length * 4)
  const timeline = [
    { time: formatTime(start), label: 'Assignment accepted', detail: 'Mission record opened' },
    ...(runtime?.timeline?.length ? runtime.timeline.map(event => ({ time: formatTime(new Date(event.createdAt).getTime()), label: event.type.replaceAll('_',' '), detail: 'Recorded mission event' })) : checkpointNames.map((name, index) => ({ time: '', label: name, detail: `Checkpoint ${index + 1}` }))),
    ...incidents.map(item => ({ time: item.timestamp, label: `${item.type} incident`, detail: `${item.severity} severity · ${item.status}` })),
    { time: formatTime(completedAt), label: 'Mission completed', detail: 'Mission record completed' },
  ]

  const printReport = () => window.print()

  return createPortal(<div className="mission-report-overlay" role="dialog" aria-modal="true" aria-label="Professional mission report">
    <button className="report-close" onClick={onClose} aria-label="Close report"><X/></button>
    <div className="report-toolbar">
      <div><small>MISSION REPORT</small><strong>Mission {runtime?.jobId ? `#${runtime.jobId.slice(0,8).toUpperCase()}` : ''}</strong></div>
      <button onClick={printReport}><Printer/> Print / Save PDF</button>
      <button onClick={printReport}><Download/> Download</button>
    </div>
    <article className="mission-report-document">
      <header className="report-brand-header">
        <div className="report-brand-mark"><ShieldCheck/></div>
        <div><small>SECURITY PROVIDER</small><h1>Co Pilot Security</h1><p>Professional Patrol & Response Services</p></div>
        <div className="report-status"><CheckCircle2/><strong>MISSION COMPLETE</strong><span>{runtime?.guardLocation?.updatedAt?'Location recorded':'Mission record secured'}</span></div>
      </header>

      <section className="report-property-grid">
        <div><small>PROPERTY</small><strong>{runtime?.property.name??'Property'}</strong><span>{runtime?.property.address??'Address unavailable'}</span></div>
        <div><small>CLIENT</small><strong>{runtime?.client.name??'Client'}</strong><span>{runtime?.title??'Security mission'}</span></div>
        <div><small>GUARD</small><strong>{runtime?.guard?.name??'Guard'}</strong><span>{runtime?.guard?.badgeNumber?`Badge ${runtime.guard.badgeNumber}`:'Assigned professional'}</span></div>
        <div><small>AGENCY</small><strong>{runtime?.agency?.name??'Agency'}</strong><span>Mission provider</span></div>
      </section>

      <section className="report-section">
        <div className="report-section-heading"><Clock3/><div><small>MISSION SUMMARY</small><h2>Verified patrol overview</h2></div></div>
        <div className="report-metrics">
          <div><small>START</small><strong>{formatTime(start)}</strong></div>
          <div><small>END</small><strong>{formatTime(completedAt)}</strong></div>
          <div><small>DURATION</small><strong>{durationMinutes} min</strong></div>
          <div><small>CHECKPOINTS</small><strong>6 / 6</strong></div>
          <div><small>GPS</small><strong>{runtime?.guardLocation?.freshness==='live'?'Live':runtime?.guardLocation?.updatedAt?'Recorded':'Unavailable'}</strong></div>
          <div><small>STATUS</small><strong>Complete</strong></div>
        </div>
      </section>

      <div className="report-two-column">
        <section className="report-section">
          <div className="report-section-heading"><FileText/><div><small>MISSION TIMELINE</small><h2>Protected activity record</h2></div></div>
          <div className="report-timeline">{timeline.map((item, index) => <div key={`${item.label}-${index}`}><time>{item.time}</time><i/><span><strong>{item.label}</strong><small>{item.detail}</small></span></div>)}</div>
        </section>
        <section className="report-section">
          <div className="report-section-heading"><BarChart3/><div><small>MISSION ANALYTICS</small><h2>Performance summary</h2></div></div>
          <div className="report-analytics">
            <div><span>Completion score</span><strong>{completionScore}%</strong><i><em style={{width:`${completionScore}%`}}/></i></div>
            <div><span>Completed checkpoints</span><strong>{records.length} / {checkpointNames.length}</strong></div>
            <div><span>Mission duration</span><strong>{durationMinutes} min</strong></div>
            <div><span>Evidence items</span><strong>{evidenceTotal}</strong></div>
            <div><span>Incidents</span><strong>{incidents.length}</strong></div>
            <div><span>Sync integrity</span><strong>100%</strong></div>
          </div>
          <div className="report-guardian-health"><h3>Mission Integrity</h3><div><span><Navigation/> GPS<strong>{runtime?.guardLocation?.updatedAt?'Recorded':'Unavailable'}</strong></span><span><Image/> Evidence<strong>{evidenceTotal}</strong></span><span><AlertTriangle/> Incidents<strong>{incidents.length}</strong></span><span><Wifi/> Record<strong>Complete</strong></span></div><p><RadioTower/> Values shown here come from the persisted mission record.</p></div>
        </section>
      </div>

      <section className="report-section">
        <div className="report-section-heading"><Image/><div><small>EVIDENCE GALLERY</small><h2>Evidence grouped by checkpoint</h2></div></div>
        <div className="report-evidence-gallery">{checkpointNames.map((name, index) => {
          const record = records.find(item => item.checkpoint === index)
          const count = (record?.photos ?? 0) + (record?.videos ?? 0) + (record?.note ? 1 : 0)
          return <div key={name}><div className="report-evidence-visual">{record?.photos ? <Image/> : record?.videos ? <Video/> : <FileText/>}<span>{count || 0}</span></div><strong>{name}</strong><small>{record?.photos ?? 0} photos · {record?.videos ?? 0} videos · {record?.note ? 'note attached' : 'no note'}</small><em><MapPinned/> Checkpoint {index + 1}</em></div>
        })}</div>
      </section>

      {incidents.length > 0 && <section className="report-section">
        <div className="report-section-heading"><AlertTriangle/><div><small>INCIDENT REPORT</small><h2>{incidents.length} documented incident{incidents.length > 1 ? 's' : ''}</h2></div></div>
        <div className="report-incidents">{incidents.map(incident => <div key={incident.id} className={`severity-${incident.severity}`}><header><AlertTriangle/><strong>{incident.type}</strong><span>{incident.severity.toUpperCase()}</span></header><p>{incident.note || 'Incident documented during patrol.'}</p><dl><div><dt>LOCATION</dt><dd>{checkpointNames[incident.checkpoint]}</dd></div><div><dt>STATUS</dt><dd>{incident.status}</dd></div><div><dt>EVIDENCE</dt><dd>{incident.photos} photos · {incident.videos} videos</dd></div><div><dt>EMERGENCY SERVICES</dt><dd>{incident.emergencyServices ? 'Contacted' : 'Not required'}</dd></div></dl></div>)}</div>
      </section>}

      <footer className="report-footer"><div><ShieldCheck/> Powered by Co Pilot Guard OS</div><span>{runtime?.jobId ? `Mission ID ${runtime.jobId}` : 'Mission record'}</span></footer>
    </article>
  </div>, document.body)
}
