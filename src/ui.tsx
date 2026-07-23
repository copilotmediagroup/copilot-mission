import type { ReactNode } from 'react'
import { Bell, BriefcaseBusiness, Home, Menu, MessageSquare, UserRound } from 'lucide-react'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <div className="brand-shield"><span>CP</span></div>
    {!compact && <div><strong>CO <em>PILOT</em></strong><small>SECURITY MARKETPLACE</small></div>}
  </div>
}

export function StatusChip({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'gray' | 'blue' | 'orange' | 'purple' }) {
  return <span className={`status-chip ${tone}`}><i />{children}</span>
}

export function PrimaryButton({ children, tone = 'blue', onClick }: { children: ReactNode; tone?: 'blue' | 'green' | 'orange' | 'purple'; onClick?: () => void }) {
  return <button className={`primary-button ${tone}`} onClick={onClick}>{children}</button>
}

export function SecondaryButton({ children }: { children: ReactNode }) {
  return <button className="secondary-button">{children}</button>
}

export function PhoneShell({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return <div className={`phone-shell ${light ? 'light' : ''}`}>
    <div className="phone-notch" />
    <div className="phone-screen">
      <div className="statusbar"><strong>9:41</strong><span>▮▮ ◔ ▰</span></div>
      {children}
    </div>
  </div>
}

export function AppHeader({ light = false, title }: { light?: boolean; title?: string }) {
  return <div className="app-header">
    <Menu size={18} />
    {title ? <strong className="app-title">{title}</strong> : <span />}
    <Bell size={17} className="bell" />
  </div>
}

export function BottomNav({ light = false }: { light?: boolean }) {
  return <nav className={`bottom-nav ${light ? 'light' : ''}`}>
    <div className="active"><Home /><span>Home</span></div>
    <div><BriefcaseBusiness /><span>Jobs</span></div>
    <div><MessageSquare /><span>Messages</span></div>
    <div><UserRound /><span>Profile</span></div>
  </nav>
}

export function Metric({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return <div className={`metric ${accent ? 'accent' : ''}`}><strong>{value}</strong><span>{label}</span></div>
}
