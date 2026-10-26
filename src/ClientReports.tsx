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
  Star,
  UserRound,
  Video,
  X,
} from 'lucide-react'
import {
  getClientReports,
  getMyMissionGuardRatings,
  rateMissionGuard,
  subscribeToReports,
  type MissionReportRecord,
} from './modules/reporting/reportingRepository'
import { getMissionEvidenceWithUrls,type MissionEvidenceMediaWithUrl } from './modules/mission/missionEvidenceRepository'

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
        <p>Guard-published patrol records, preserved for your property.</p>
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
      <p>Completed mission reports appear as soon as your guard publishes them.</p>
    </div>}

    {selected && <PublishedClientReport report={selected} onClose={() => setSelected(null)} />}
  </section>
}

export function PublishedClientReport({ report, onClose }: { report: MissionReportRecord; onClose: () => void }) {
  const snapshot = report.snapshot ?? {}
  const mission = snapshot.mission ?? {}
  const guards = safeArray<any>(snapshot.guards)
  const evidence = guards.length ? guards.flatMap((guard:any)=>safeArray<any>(guard?.mission?.evidence)) : safeArray<any>(mission.evidence)
  const timeline = safeArray<any>(snapshot.timeline)
  const [media,setMedia]=useState<MissionEvidenceMediaWithUrl[]>([])
  const [mediaLoading,setMediaLoading]=useState(true)
  const [mediaFailed,setMediaFailed]=useState(false)
  const [ratings,setRatings]=useState<Record<string,{rating:number;comment:string|null}>>({})
  const [ratingDrafts,setRatingDrafts]=useState<Record<string,{rating:number;comment:string}>>({})
  const [ratingBusy,setRatingBusy]=useState<string|null>(null)
  const [ratingError,setRatingError]=useState('')
  useEffect(()=>{let alive=true;void getMyMissionGuardRatings(report.job_id).then(rows=>{if(alive)setRatings(Object.fromEntries(rows.map(r=>[r.guard_id,{rating:r.rating,comment:r.comment}])))}).catch(()=>undefined);return()=>{alive=false}},[report.job_id])
  useEffect(()=>{let alive=true;setMediaLoading(true);setMediaFailed(false);getMissionEvidenceWithUrls(report.job_id).then(rows=>{if(alive)setMedia(rows)}).catch(()=>{if(alive){setMedia([]);setMediaFailed(true)}}).finally(()=>{if(alive)setMediaLoading(false)});return()=>{alive=false}},[report.job_id])
  const rateableGuards=useMemo(()=>guards.length?guards.map((entry:any)=>({id:entry?.guard?.id,name:entry?.guard?.name??'Assigned Guard'})).filter((g:any)=>g.id):snapshot?.guard?.id?[{id:snapshot.guard.id,name:snapshot.guard.name??'Assigned Guard'}]:[],[guards,snapshot?.guard?.id,snapshot?.guard?.name])
  const submitRating=async(guardId:string)=>{const draft=ratingDrafts[guardId];if(!draft?.rating||ratingBusy)return;setRatingBusy(guardId);setRatingError('');try{const saved=await rateMissionGuard(report.job_id,guardId,draft.rating,draft.comment);setRatings(v=>({...v,[guardId]:{rating:saved.rating,comment:saved.comment}}))}catch(e){setRatingError(e instanceof Error?e.message:'Unable to submit rating.')}finally{setRatingBusy(null)}}
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
            <span>Guard published</span>
          </div>
        </header>

        <section className="client-report-summary-grid">
          <div><Clock3 /><span><small>COMPLETED</small><strong>{formatDate(mission.completed_at ?? snapshot?.job?.completed_at)}</strong></span></div>
          <div><UserRound /><span><small>GUARD</small><strong>{snapshot?.guard?.name ?? (guards.length?`${guards.length} assigned guards`:'Assigned Guard')}</strong></span></div>
          <div><Building2 /><span><small>AGENCY</small><strong>{snapshot?.agency?.name ?? 'Security Agency'}</strong></span></div>
          <div><CheckCircle2 /><span><small>CHECKPOINTS</small><strong>{guards.length?`${guards.filter((g:any)=>Number(g?.mission?.checkpoint_index)>=6).length}/${guards.length} guards verified`:'6 of 6 verified'}</strong></span></div>
        </section>

        {guards.length > 0 && <section className="client-report-section">
          <div className="client-report-section-heading"><div><small>MULTI-GUARD COVERAGE</small><h2>Guard completion</h2></div><span>{guards.length} guards</span></div>
          <div className="client-report-checkpoints">{guards.map((entry:any)=><div key={entry?.slot_number??entry?.guard?.id}><ShieldCheck/><span><strong>Guard {entry?.slot_number}: {entry?.guard?.name??'Assigned Guard'}</strong><small>{Number(entry?.mission?.checkpoint_index??0)}/6 checkpoints · {entry?.mission?.state??'unknown'}</small></span><div className="client-report-evidence-counts"><em>{safeArray(entry?.mission?.evidence).reduce((n:number,x:any)=>n+Number(x?.photos||0)+Number(x?.videos||0)+(x?.note?1:0),0)} evidence</em></div></div>)}</div>
        </section>}

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
          <div className="client-report-section-heading"><div><small>GUARD EVIDENCE</small><h2>Photos & videos</h2></div>{!mediaLoading&&!mediaFailed&&<span>{media.length} media item{media.length===1?'':'s'}</span>}</div>
          {mediaLoading?<p>Loading secure evidence…</p>:mediaFailed?<p>Evidence media could not be loaded.</p>:media.length?<div className="client-evidence-gallery">{media.map(item=><figure key={item.id}>{item.kind==='video'?<video src={item.url} controls preload="metadata"/>:<a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={`Guard evidence checkpoint ${item.checkpoint_index+1}`}/></a>}<figcaption>{guards.length?`${guards.find((g:any)=>g?.guard?.id===item.guard_id)?.guard?.name??'Guard'} · `:''}Checkpoint {item.checkpoint_index+1} · {new Date(item.captured_at).toLocaleString()}</figcaption></figure>)}</div>:<p>No uploaded photo or video evidence for this mission.</p>}
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
            </div>) : <div><i /><span><strong>Mission completed</strong><small>{formatDate(mission.completed_at ?? snapshot?.job?.completed_at)}</small></span></div>}
          </div>
        </section>

        {rateableGuards.length>0 && <section className="client-report-section client-guard-rating-section"><div className="client-report-section-heading"><div><small>YOUR EXPERIENCE</small><h2>Rate your guard</h2></div><span>Individual guard rating</span></div><p className="client-rating-help">Your rating is for the guard who served this mission — not the security agency.</p>{ratingError&&<div className="client-rating-error">{ratingError}</div>}<div className="client-guard-rating-list">{rateableGuards.map((guard:any)=>{const saved=ratings[guard.id],draft=ratingDrafts[guard.id]??{rating:0,comment:''};return <div className="client-guard-rating-card" key={guard.id}><div className="client-rating-guard"><UserRound/><span><strong>{guard.name}</strong><small>{saved?'Rating submitted':'How was your experience?'}</small></span></div>{saved?<div className="client-rating-saved"><div className="client-rating-stars">{[1,2,3,4,5].map(n=><Star key={n} className={n<=saved.rating?'filled':''}/>)}</div>{saved.comment&&<p>“{saved.comment}”</p>}<small>Thank you for rating this guard.</small></div>:<><div className="client-rating-stars interactive" role="radiogroup" aria-label={`Rate ${guard.name} from 1 to 5 stars`}>{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} star${n===1?'':'s'}`} onClick={()=>setRatingDrafts(v=>({...v,[guard.id]:{...draft,rating:n}}))}><Star className={n<=draft.rating?'filled':''}/></button>)}</div><textarea maxLength={1000} value={draft.comment} onChange={e=>setRatingDrafts(v=>({...v,[guard.id]:{...draft,comment:e.target.value}}))} placeholder="Optional: Tell us about your experience with this guard."/><button className="client-rating-submit" type="button" disabled={!draft.rating||ratingBusy===guard.id} onClick={()=>void submitRating(guard.id)}>{ratingBusy===guard.id?'Submitting…':'Submit guard rating'}</button></>}</div>})}</div></section>}

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
