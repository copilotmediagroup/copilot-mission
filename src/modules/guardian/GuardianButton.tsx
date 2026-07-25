import { useState } from 'react'
import { BellRing, CheckCircle2, EyeOff, Radio, Shield, ShieldAlert, Siren, X } from 'lucide-react'
import type { MissionState } from '../../types'
import { useGuardian } from './GuardianContext'

const activeStates: MissionState[] = ['enroute','arrived','patrol','proof']

export default function GuardianButton({ missionState }: { missionState: MissionState }) {
  const guardian = useGuardian()
  const [open, setOpen] = useState(false)
  if (!activeStates.includes(missionState)) return null

  const urgent = guardian.state === 'alert' || guardian.state === 'acknowledged' || guardian.state === 'backup_enroute'
  return <>
    <button className={`guardian-fab guardian-${guardian.state}`} onClick={()=>setOpen(true)} aria-label="Open Guardian Safety">
      {urgent ? <ShieldAlert/> : <Shield/>}<span>{urgent ? 'GUARDIAN ALERT' : 'GUARDIAN'}</span><i/>
    </button>
    {open && <div className="guardian-backdrop" onClick={()=>setOpen(false)}>
      <section className={`guardian-sheet guardian-sheet-${guardian.state}`} onClick={event=>event.stopPropagation()}>
        <header><div><small>CO PILOT SAFETY SYSTEM</small><h2>Guardian</h2></div><button onClick={()=>setOpen(false)}><X/></button></header>
        <div className="guardian-status"><span>{urgent ? <BellRing/> : <Radio/>}</span><div><small>CURRENT STATE</small><strong>{guardian.state.replace('_',' ').toUpperCase()}</strong><p>{guardian.silentMode ? 'Silent emergency signal active.' : guardian.state === 'monitoring' ? 'Guardian is monitoring this mission.' : 'Agency safety workflow is active.'}</p></div></div>
        <div className="guardian-signals">{guardian.signals.map(signal=><div key={signal.id}><i className={`signal-${signal.status}`}/><span><strong>{signal.label}</strong><small>{signal.detail}</small></span></div>)}</div>
        {guardian.state === 'monitoring' && <>
          <button className="guardian-emergency" onClick={()=>guardian.triggerAlert(false)}><Siren/><span><strong>REQUEST EMERGENCY ASSISTANCE</strong><small>Immediately alert the agency and share live location</small></span></button>
          <button className="guardian-silent" onClick={()=>guardian.triggerAlert(true)}><EyeOff/><span><strong>SILENT ALERT</strong><small>No sound, vibration, or visible countdown</small></span></button>
        </>}
        {guardian.state === 'alert' && <button className="guardian-stage-action" onClick={guardian.acknowledge}><CheckCircle2/> SIMULATE AGENCY ACKNOWLEDGEMENT</button>}
        {guardian.state === 'acknowledged' && <button className="guardian-stage-action" onClick={guardian.dispatchBackup}><Radio/> SIMULATE BACKUP DISPATCH</button>}
        {guardian.state === 'backup_enroute' && <button className="guardian-stage-action" onClick={guardian.resolve}><CheckCircle2/> MARK SAFETY EVENT RESOLVED</button>}
        {guardian.state === 'resolved' && <button className="guardian-stage-action" onClick={()=>{guardian.reset();setOpen(false)}}><Shield/> RETURN TO MONITORING</button>}
        <p className="guardian-footnote">Prototype foundation. Agency delivery, GPS telemetry, device sensors, and automated escalation connect in the realtime build.</p>
      </section>
    </div>}
  </>
}
