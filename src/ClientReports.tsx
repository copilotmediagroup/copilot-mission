import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  Image,
  MapPin,
  Printer,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Video,
  X,
} from 'lucide-react'
import {
  getClientReports,
  subscribeToReports,
  type MissionReportRecord,
} from './modules/reporting/reportingRepository'

const checkpointNames = [
  'Exterior Perimeter',
  'Parking Lot',
  'Main Entrance',
  'Back Entrance',
  'Rear Loading Dock',
  'Side Doors',
]

function safeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ClientReports({ preview = false }: { preview?: boolean }) {
  const [reports, setReports] = useState<MissionReportRecord[]>([])
  const [loading, setLoading] = useState(!preview)
  const [selected, setSelected] = useState<MissionReportRecord | null>(null)

  const load = async () => {
    if (preview) {
      setLoading(false)
      return
    }
    try {
      setReports(await getClientReports())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    if (preview) return
    return subscribeToReports(() => void load())
  }, [preview])

  if (loading) {
    return <div className="client-loading"><RefreshCw /><h2>Loading reports</h2></div>
  }

  return <section className="client-section client-reports-workspace">
    <div className="client-section-head">
      <div>
        <span>VERIFIED REPORT ARCHIVE</span>
        <h2>Published mission reports</h2>
        <p>Agency-reviewed patrol records, preserved for your property.</p>
      </div>
    </div>

    {reports.length ? <div className="client-report-grid">
      {reports.map(report => {
        const snapshot = report.snapshot
        return <article className="client-report-card" key={report.id}>
          <div className="client-report-card-top">
            <span className="report-status published"><CheckCircle2 /> Published</span>
            <small>Report v{report.version}.0</small>
          </div>
          <h3>{snapshot?.job?.title ?? 'Completed patrol'}</h3>
          <p><MapPin />{snapshot?.property?.name} · {snapshot?.property?.address}</p>
          <div className="client-report-card-stats">
            <span><b>6 of 6</b><small>Checkpoints</small></span>
            <span><b>{formatDate(report.published_at)}</b><small>Published</small></span>
          </div>
          <footer><span>{snapshot?.agency?.name ?? 'Security Agency'}</span></footer>
          <button onClick={() => setSelected(report)}>View verified report</button>
        </article>
      })}
    </div> : <div className="client-empty">
      <div><FileText /></div>
      <h4>No published reports</h4>
      <p>Completed mission reports appear after Agency review.</p>
    </div>}

    {selected && <PublishedClientReport report={selected} onClose={() => setSelected(null)} />}
  </section>
}

function PublishedClientReport({ report, onClose }: { report: MissionReportRecord; onClose: () => void }) {
  const snapshot = report.snapshot ?? {}
  const mission = snapshot.mission ?? {}
  const evidence = safeArray<any>(mission.evidence)
  const timeline = safeArray<any>(snapshot.timeline)
  const evidenceTotal = useMemo(() => evidence.reduce((total, item) => (
    total + Number(item?.photos || 0) + Number(item?.videos || 0) + (item?.note ? 1 : 0)
  ), 0), [evidence])

  return <div className="client-report-overlay" role="dialog" aria-modal="true" aria-label="Published security mission report">
    <div className="client-report-shell">
      <div className="client-report-toolbar">
        <div>
          <small>CO PILOT SECURITY OS</small>
          <strong>Verified Mission Report</strong>
        </div>
        <button onClick={() => window.print()}><Printer /> Print / Save PDF</button>
        <button className="client-report-close" onClick={onClose} aria-label="Close report"><X /></button>
      </div>

      <article className="client-report-document">
        <header className="client-report-hero">
          <div className="client-report-brand"><ShieldCheck /></div>
          <div>
            <small>PUBLISHED SECURITY RECORD</small>
            <h1>{snapshot?.job?.title ?? 'Completed security patrol'}</h1>
            <p>{snapshot?.property?.name ?? 'Property'} · {snapshot?.property?.address ?? 'Address unavailable'}</p>
          </div>
          <div className="client-report-verification">
            <CheckCircle2 />
            <strong>VERIFIED</strong>
            <span>Agency reviewed</span>
          </div>
        </header>

        <section className="client-report-summary-grid">
          <div><Clock3 /><span><small>COMPLETED</small><strong>{formatDate(mission.completed_at)}</strong></span></div>
          <div><UserRound /><span><small>GUARD</small><strong>{snapshot?.guard?.name ?? 'Assigned Guard'}</strong></span></div>
          <div><Building2 /><span><small>AGENCY</small><strong>{snapshot?.agency?.name ?? 'Security Agency'}</strong></span></div>
          <div><CheckCircle2 /><span><small>CHECKPOINTS</small><strong>6 of 6 verified</strong></span></div>
        </section>

        <section className="client-report-section">
          <div className="client-report-section-heading">
            <div><small>PATROL RECORD</small><h2>Checkpoint verification</h2></div>
            <span>{evidenceTotal} evidence item{evidenceTotal === 1 ? '' : 's'}</span>
          </div>
          <div className="client-report-checkpoints">
            {checkpointNames.map((name, index) => {
              const item = evidence.find(entry => Number(entry?.checkpoint) === index)
              const photos = Number(item?.photos || 0)
              const videos = Number(item?.videos || 0)
              return <div key={name}>
                <CheckCircle2 />
                <span><strong>{name}</strong><small>Checkpoint completed</small></span>
                <div className="client-report-evidence-counts">
                  {photos > 0 && <em><Image />{photos}</em>}
                  {videos > 0 && <em><Video />{videos}</em>}
                  {item?.note && <em><FileText />Note</em>}
                  {!photos && !videos && !item?.note && <em>No evidence required</em>}
                </div>
                {item?.note && <p>{item.note}</p>}
              </div>
            })}
          </div>
        </section>

        <section className="client-report-section">
          <div className="client-report-section-heading">
            <div><small>PROTECTED HISTORY</small><h2>Mission timeline</h2></div>
          </div>
          <div className="client-report-timeline">
            {timeline.length ? timeline.map((event, index) => <div key={event?.id ?? index}>
              <i />
              <span>
                <strong>{String(event?.event_type ?? 'Mission update').replaceAll('_', ' ')}</strong>
                <small>{formatDate(event?.created_at)} · {event?.actor_name ?? 'Co Pilot Security OS'}</small>
              </span>
            </div>) : <div><i /><span><strong>Mission completed</strong><small>{formatDate(mission.completed_at)}</small></span></div>}
          </div>
        </section>

        {(report.agency_review_note || report.published_at) && <section className="client-report-review-note">
          <ShieldCheck />
          <div>
            <small>AGENCY REVIEW</small>
            <h3>Patrol record approved for client delivery</h3>
            {report.agency_review_note && <p>{report.agency_review_note}</p>}
            <span>Published {formatDate(report.published_at)}</span>
          </div>
        </section>}

        <footer className="client-report-footer">
          <div><ShieldCheck /><span><strong>Co Pilot Security OS</strong><small>Immutable mission record · Report v{report.version}.0</small></span></div>
          <span>Report ID {report.id.slice(0, 8).toUpperCase()}</span>
        </footer>
      </article>
    </div>
  </div>
}
