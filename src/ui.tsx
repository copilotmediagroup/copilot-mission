import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Bell, BriefcaseBusiness, Home, LoaderCircle, Menu, MessageSquare, ShieldCheck, UserRound, X } from 'lucide-react'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <div className="brand-shield"><span>CP</span></div>
    {!compact && <div><strong>CO <em>PILOT</em></strong><small>SECURITY MARKETPLACE</small></div>}
  </div>
}

type StatusTone = 'green' | 'gray' | 'blue' | 'orange' | 'purple' | 'red'
export function StatusChip({ children, tone = 'green' }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`status-chip ${tone}`}><i aria-hidden="true" />{children}</span>
}

type ButtonTone = 'blue' | 'green' | 'orange' | 'purple' | 'red'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  tone?: ButtonTone
  loading?: boolean
  fullWidth?: boolean
}

export function PrimaryButton({ children, tone = 'blue', loading = false, fullWidth = false, className = '', disabled, ...props }: ButtonProps) {
  return <button
    className={`primary-button ${tone} ${fullWidth ? 'button-full' : ''} ${className}`.trim()}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && <LoaderCircle className="button-spinner" aria-hidden="true" />}
    <span className="button-label">{children}</span>
  </button>
}

export function SecondaryButton({ children, loading = false, fullWidth = false, className = '', disabled, ...props }: Omit<ButtonProps, 'tone'>) {
  return <button
    className={`secondary-button ${fullWidth ? 'button-full' : ''} ${className}`.trim()}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading && <LoaderCircle className="button-spinner" aria-hidden="true" />}
    <span className="button-label">{children}</span>
  </button>
}

export function PhoneShell({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <div className={`phone-shell ${light ? 'light' : ''}`}>
    <div className="phone-notch" />
    <div className="phone-screen">
      <div className="desktop-topbar">
        <div className="desktop-logo"><span><ShieldCheck /></span><div><strong>CO <em>PILOT</em></strong><small>SECURITY MARKETPLACE</small></div></div>
        <div className="desktop-role"><span>GUARD PORTAL</span><b>David Martinez</b></div>
      </div>
      <div className="statusbar"><strong>9:41</strong><span>▮▮ ◔ ▰</span></div>
      {children}
    </div>
  </div>
}

type GuardNavTarget = 'home' | 'jobs' | 'messages' | 'profile' | 'menu' | 'alerts'

const guardNavCopy: Record<GuardNavTarget, { title: string; body: string }> = {
  home: { title: 'Guard Home', body: 'This returns the guard to the current mission dashboard and availability state.' },
  jobs: { title: 'Active Jobs', body: 'Current assignment, route, checklist, evidence, and mission status stay here until the job is complete.' },
  messages: { title: 'Messages', body: 'Agency broadcasts, mission alerts, and client-facing updates will surface here in real time.' },
  profile: { title: 'Guard Profile', body: 'Guard identity, duty status, GPS permission, and roster details are controlled by the assigned agency.' },
  menu: { title: 'Guard Menu', body: 'Quick access to mission tools, evidence, route, alerts, and profile controls.' },
  alerts: { title: 'Notifications', body: 'New assignments, route changes, agency messages, and report updates will appear here.' },
}

function GuardNavSheet({ target, onClose }: { target: GuardNavTarget; onClose: () => void }) {
  const copy = guardNavCopy[target]

  return <div className="guard-nav-sheet-layer" role="dialog" aria-modal="true">
    <button type="button" className="guard-nav-sheet-scrim" onClick={onClose} aria-label="Close guard navigation" />
    <section className="guard-nav-sheet">
      <header><strong>{copy.title}</strong><button type="button" onClick={onClose} aria-label="Close"><X /></button></header>
      <p>{copy.body}</p>
      <button type="button" className="guard-nav-primary" onClick={onClose}>Back to mission</button>
    </section>
  </div>
}

export function AppHeader({ light = false, title }: { light?: boolean; title?: string }) {
  const [target, setTarget] = useState<GuardNavTarget | null>(null)

  return <div className={`app-header ${light ? 'light' : ''}`}>
    <button type="button" className="app-header-action" onClick={()=>setTarget('menu')} aria-label="Open guard menu"><Menu size={18} /></button>
    {title ? <strong className="app-title">{title}</strong> : <span />}
    <button type="button" className="app-header-action bell" onClick={()=>setTarget('alerts')} aria-label="Open guard notifications"><Bell size={17} /></button>
    {target && <GuardNavSheet target={target} onClose={()=>setTarget(null)} />}
  </div>
}

export function BottomNav({ light = false, active = 'home' }: { light?: boolean; active?: GuardNavTarget }) {
  const [target, setTarget] = useState<GuardNavTarget | null>(null)
  const items = [
    ['home', Home, 'Home'],
    ['jobs', BriefcaseBusiness, 'Jobs'],
    ['messages', MessageSquare, 'Messages'],
    ['profile', UserRound, 'Profile'],
  ] as const

  return <nav className={`bottom-nav ${light ? 'light' : ''}`} aria-label="Primary navigation">
    {items.map(([id, Icon, label]) => <button key={id} type="button" className={active === id ? 'active' : ''} onClick={()=>setTarget(id)}><Icon /><span>{label}</span></button>)}
    {target && <GuardNavSheet target={target} onClose={()=>setTarget(null)} />}
  </nav>
}

export function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return <div className={`metric ds-card ${accent ? 'accent' : ''}`}><strong>{value}</strong><span>{label}</span></div>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`ds-skeleton ${className}`.trim()} aria-hidden="true" />
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <section className="ds-empty-state">
    {icon && <div className="ds-empty-icon">{icon}</div>}
    <h3>{title}</h3>
    <p>{description}</p>
    {action && <div className="ds-empty-action">{action}</div>}
  </section>
}
