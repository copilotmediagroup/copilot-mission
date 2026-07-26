import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Bell, BriefcaseBusiness, Home, LoaderCircle, Menu, MessageSquare, ShieldCheck, UserRound } from 'lucide-react'

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

export function AppHeader({ light = false, title }: { light?: boolean; title?: string }) {
  return <div className={`app-header ${light ? 'light' : ''}`}>
    <Menu size={18} />
    {title ? <strong className="app-title">{title}</strong> : <span />}
    <Bell size={17} className="bell" />
  </div>
}

export function BottomNav({ light = false }: { light?: boolean }) {
  return <nav className={`bottom-nav ${light ? 'light' : ''}`} aria-label="Primary navigation">
    <div className="active"><Home /><span>Home</span></div>
    <div><BriefcaseBusiness /><span>Jobs</span></div>
    <div><MessageSquare /><span>Messages</span></div>
    <div><UserRound /><span>Profile</span></div>
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
