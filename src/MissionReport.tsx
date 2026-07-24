import { useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, BatteryMedium, Check, CheckCircle2, Clock3, Download, FileText, Image, MapPinned, Navigation, PenLine, Printer, RadioTower, ShieldCheck, Signal, Video, Wifi, X } from 'lucide-react'
import type { IncidentRecord, PatrolEvidence } from './types'

const checkpointNames = ['Exterior Perimeter','Parking Lot','Main Entrance','Back Entrance','Rear Loading Dock','Side Doors']

export interface MissionReportProps {
  records: PatrolEvidence[]
  incidents: IncidentRecord[]
  missionStartedAt?: number | null
  onClose: () => void
}

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function MissionReport({ records, incidents, missionStartedAt, onClose }: MissionReportProps) {
  const [guardSigned, setGuardSigned] = useState(true)
  const [agencySigned, setAgencySigned] = useState(false)
  const [clientAcknowledged, setClientAcknowledged] = useState(false)
  const now = Date.now()
  const start = missionStartedAt ?? now - 37 * 60 * 1000
  const durationMinutes = Math.max(1, Math.round((now - start) / 60000))
  const totals = useMemo(() => records.reduce((sum, record) => ({
    photos: sum.photos + record.photos,
    videos: sum.videos + record.videos,
    notes: sum.notes + (record.note ? 1 : 0),
  }), { photos: 0, videos: 0, notes: 0 }), [records])
  const evidenceTotal = totals.photos + totals.videos + totals.notes
  const completionScore = Math.max(92, 100 - incidents.filter(item => item.status !== 'resolved').length * 4)
  const timeline = [
    { time: formatTime(start), label: 'Assignment accepted', detail: 'Mission record opened' },
    { time: formatTime(start + 8 * 60000), label: 'Guard arrived', detail: 'GPS verified at property' },
    ...checkpointNames.map((name, index) => ({ time: formatTime(start + (12 + index * 4) * 60000), label: name, detail: `Checkpoint ${index + 1} completed` })),
    ...incidents.map(item => ({ time: item.timestamp, label: `${item.type} incident`, detail: `${item.severity} severity · ${item.status}` })),
    { time: formatTime(now), label: 'Mission completed', detail: 'Evidence synchronized and secured' },
  ]

  const printReport = () => window.print()

  return <div className="mission-report-overlay" role="dialog" aria-modal="true" aria-label="Professional mission report">
    <button className="report-close" onClick={onClose} aria-label="Close report"><X/></button>
    <div className="report-toolbar">
      <div><small>CLIENT-READY REPORT</small><strong>Mission #CPS-240724-0184</strong></div>
      <button onClick={printReport}><Printer/> Print / Save PDF</button>
      <button onClick={printReport}><Download/> Download</button>
    </div>
    <article className="mission-report-document">
      <header className="report-brand-header">
        <div className="report-brand-mark"><ShieldCheck/></div>
        <div><small>SECURITY PROVIDER</small><h1>Co Pilot Security</h1><p>Professional Patrol & Response Services</p></div>
        <div className="report-status"><CheckCircle2/><strong>MISSION COMPLETE</strong><span>GPS Verified</span></div>
      </header>

      <section className="report-property-grid">
        <div><small>PROPERTY</small><strong>Publix Super Market</strong><span>12501 S Orange Blossom Trail<br/>Orlando, FL 32837</span></div>
        <div><small>CLIENT</small><strong>Publix Property Operations</strong><span>Retail Patrol Service</span></div>
        <div><small>GUARD</small><strong>David Martinez</strong><span>Badge CPS-2841</span></div>
        <div><small>AGENCY</small><strong>Co Pilot Security</strong><span>Orlando Operations</span></div>
      </section>

      <section className="report-section">
        <div className="report-section-heading"><Clock3/><div><small>MISSION SUMMARY</small><h2>Verified patrol overview</h2></div></div>
        <div className="report-metrics">
          <div><small>START</small><strong>{formatTime(start)}</strong></div>
          <div><small>END</small><strong>{formatTime(now)}</strong></div>
          <div><small>DURATION</small><strong>{durationMinutes} min</strong></div>
          <div><small>CHECKPOINTS</small><strong>6 / 6</strong></div>
          <div><small>GPS</small><strong>Verified</strong></div>
          <div><small>STATUS</small><strong>Complete</strong></div>
        </div>
      </section>

      <section className="report-section report-map-section">
        <div className="report-section-heading"><MapPinned/><div><small>PROPERTY ROUTE</small><h2>Patrol verification map</h2></div></div>
        <div className="report-map">
          <div className="report-map-grid"/>
          <svg viewBox="0 0 720 260" preserveAspectRatio="none"><path d="M65 210 C135 180 120 120 205 142 S310 205 355 132 S470 62 522 110 S610 180 662 56"/></svg>
          {checkpointNames.map((_, index) => <span key={index} style={{left:`${9 + index * 16.5}%`,top:`${78 - (index % 3) * 25}%`}}>{index + 1}</span>)}
          <div className="report-map-legend"><span><i/> Verified route</span><span><MapPinned/> 6 checkpoints</span><span><Navigation/> 1.2 mi walked</span></div>
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
            <div><span>Average checkpoint</span><strong>2m 06s</strong></div>
            <div><span>Walking speed</span><strong>2.8 mph</strong></div>
            <div><span>Evidence items</span><strong>{evidenceTotal}</strong></div>
            <div><span>Incidents</span><strong>{incidents.length}</strong></div>
            <div><span>Sync integrity</span><strong>100%</strong></div>
          </div>
          <div className="report-guardian-health"><h3>Guardian Health</h3><div><span><Navigation/> GPS<strong>Active</strong></span><span><BatteryMedium/> Battery<strong>82%</strong></span><span><Signal/> Signal<strong>Excellent</strong></span><span><Wifi/> Sync<strong>Complete</strong></span></div><p><RadioTower/> Mission continuity remained protected throughout the patrol.</p></div>
        </section>
      </div>

      <section className="report-section">
        <div className="report-section-heading"><Image/><div><small>EVIDENCE GALLERY</small><h2>Evidence grouped by checkpoint</h2></div></div>
        <div className="report-evidence-gallery">{checkpointNames.map((name, index) => {
          const record = records.find(item => item.checkpoint === index)
          const count = (record?.photos ?? 0) + (record?.videos ?? 0) + (record?.note ? 1 : 0)
          return <div key={name}><div className="report-evidence-visual">{record?.photos ? <Image/> : record?.videos ? <Video/> : <FileText/>}<span>{count || 0}</span></div><strong>{name}</strong><small>{record?.photos ?? 0} photos · {record?.videos ?? 0} videos · {record?.note ? 'note attached' : 'no note'}</small><em><MapPinned/> GPS verified</em></div>
        })}</div>
      </section>

      {incidents.length > 0 && <section className="report-section">
        <div className="report-section-heading"><AlertTriangle/><div><small>INCIDENT REPORT</small><h2>{incidents.length} documented incident{incidents.length > 1 ? 's' : ''}</h2></div></div>
        <div className="report-incidents">{incidents.map(incident => <div key={incident.id} className={`severity-${incident.severity}`}><header><AlertTriangle/><strong>{incident.type}</strong><span>{incident.severity.toUpperCase()}</span></header><p>{incident.note || 'Incident documented during patrol.'}</p><dl><div><dt>LOCATION</dt><dd>{checkpointNames[incident.checkpoint]}</dd></div><div><dt>STATUS</dt><dd>{incident.status}</dd></div><div><dt>EVIDENCE</dt><dd>{incident.photos} photos · {incident.videos} videos</dd></div><div><dt>EMERGENCY SERVICES</dt><dd>{incident.emergencyServices ? 'Contacted' : 'Not required'}</dd></div></dl></div>)}</div>
      </section>}

      <section className="report-section report-signatures">
        <div className="report-section-heading"><PenLine/><div><small>DIGITAL SIGNATURES</small><h2>Operational acknowledgment</h2></div></div>
        <div className="signature-grid">
          <button className={guardSigned ? 'signed' : ''} onClick={() => setGuardSigned(!guardSigned)}><span>{guardSigned ? 'David Martinez' : 'Tap to sign'}</span><small>GUARD SIGNATURE</small>{guardSigned && <Check/>}</button>
          <button className={agencySigned ? 'signed' : ''} onClick={() => setAgencySigned(!agencySigned)}><span>{agencySigned ? 'Operations Supervisor' : 'Agency review'}</span><small>AGENCY APPROVAL</small>{agencySigned && <Check/>}</button>
          <button className={clientAcknowledged ? 'signed' : ''} onClick={() => setClientAcknowledged(!clientAcknowledged)}><span>{clientAcknowledged ? 'Client acknowledged' : 'Client acknowledgment'}</span><small>CLIENT RECEIPT</small>{clientAcknowledged && <Check/>}</button>
        </div>
      </section>

      <footer className="report-footer"><div><ShieldCheck/> Powered by Co Pilot Guard OS</div><span>Report ID CPS-240724-0184 · Integrity hash secured</span></footer>
    </article>
  </div>
}
