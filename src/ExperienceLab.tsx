import { useCallback, useState, type CSSProperties } from 'react'
import { ChevronDown, Code2 } from 'lucide-react'
import GuardDashboard from './GuardDashboard'
import { states } from './data'
import type { MissionState } from './types'
import { BrandMark } from './ui'

export default function App() {
  const [state, setState] = useState<MissionState>('offline')
  const [devOpen, setDevOpen] = useState(true)
  const current = states.find(s => s.id === state)!
  const advance = useCallback(() => {
    const i = states.findIndex(s => s.id === state)
    setState(states[(i + 1) % states.length].id)
  }, [state])

  return <div className={`app state-${state}`}>
    <header className="site-header"><BrandMark/><div className="hero-title"><h1>THE <em>LIVING</em> DASHBOARD</h1><p>The dashboard evolves with every step of the mission.</p></div><div className="version"><strong>v0.1.1</strong><span>VISUAL PROTOTYPE</span></div></header>
    <section className="state-rail">{states.map(s => <button key={s.id} className={s.id===state?'active':''} style={{'--accent':s.accent} as CSSProperties} onClick={()=>setState(s.id)}><i>{s.number}</i><span><strong>{s.label}</strong><small>{s.description}</small></span></button>)}</section>
    <main className="showcase"><div className="phone-stage" key={state}><GuardDashboard state={state} onAdvance={advance}/><div className="state-caption"><strong style={{color:current.accent}}>{current.short}</strong><span>{current.description}</span></div></div>
      <aside className="design-notes"><div className="note-kicker">MISSION STATE {current.number}</div><h2>{current.label}</h2><p>{current.description}</p><div className="principle"><strong>One primary action.</strong><span>The interface reveals only what the guard needs, exactly when it is needed.</span></div><div className="principle"><strong>Living, not navigating.</strong><span>The same dashboard transforms instead of sending the guard through disconnected pages.</span></div><div className="principle"><strong>Context becomes color.</strong><span>Blue guides movement, green confirms progress, orange focuses patrol, and purple owns evidence.</span></div></aside>
    </main>
    <footer><BrandMark compact/><span>One App. One Mission. <b>Complete Every Assignment.</b></span><div className="roles"><span>GUARD</span><span>AGENCY</span><span>CLIENT</span><span>ADMIN</span></div></footer>
    <div className={`developer ${devOpen?'open':''}`}><button className="dev-trigger" onClick={()=>setDevOpen(v=>!v)}><Code2/>Developer Mode<ChevronDown/></button>{devOpen&&<div className="dev-panel"><small>MISSION STATE</small>{states.map(s=><button className={s.id===state?'active':''} onClick={()=>setState(s.id)} key={s.id}><i style={{background:s.accent}}/>{s.number}. {s.label}</button>)}</div>}</div>
  </div>
}
