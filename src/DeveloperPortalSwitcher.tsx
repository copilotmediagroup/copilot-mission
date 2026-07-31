import { useEffect, useMemo, useState } from 'react'
import { Building2, Code2, LogOut, Shield, ShieldCheck, UserRound, X } from 'lucide-react'
import type { AppRole } from './modules/auth/AuthProvider'

export type DeveloperPreview = AppRole | 'guard_lab'
export type DeveloperAccessMode = 'preview' | 'live'

const options: Array<{ id: DeveloperPreview; label: string; icon: typeof Shield }> = [
  { id: 'client', label: 'Client', icon: UserRound },
  { id: 'agency_admin', label: 'Agency', icon: Building2 },
  { id: 'guard', label: 'Guard', icon: Shield },
  { id: 'platform_admin', label: 'Platform', icon: ShieldCheck },
  { id: 'guard_lab', label: 'Guard Lab', icon: Code2 },
]

const STORAGE_KEY = 'co-pilot-developer-preview-role'

export function getStoredDeveloperPreview(fallback: DeveloperPreview): DeveloperPreview {
  const stored = localStorage.getItem(STORAGE_KEY) as DeveloperPreview | null
  return options.some(option => option.id === stored) ? stored! : fallback
}

export function DeveloperPortalSwitcher({
  value,
  actualRole,
  onChange,
  onExit,
  accessMode,
  onAccessModeChange,
  onSignOut,
}: {
  value: DeveloperPreview
  actualRole: AppRole | null
  onChange: (role: DeveloperPreview) => void
  onExit: () => void
  accessMode: DeveloperAccessMode
  onAccessModeChange: (mode: DeveloperAccessMode) => void
  onSignOut: () => void
}) {
  const [compactOpen, setCompactOpen] = useState(false)
  const displayedRole = accessMode === 'live' && actualRole ? actualRole : value
  const selected = useMemo(() => options.find(option => option.id === displayedRole) ?? options[0], [displayedRole])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, value)
  }, [value])

  return <div className={`portal-switcher ${compactOpen ? 'mobile-open' : ''}`}>
    <div className="portal-switcher-brand"><Code2/><span>DEVELOPER MODE</span><small>Signed in as {actualRole?.replace('_', ' ') ?? 'user'}</small></div>
    <div className="developer-access-toggle" role="group" aria-label="Developer access mode"><button className={accessMode === 'preview' ? 'active' : ''} onClick={() => onAccessModeChange('preview')}>Preview</button><button className={accessMode === 'live' ? 'active' : ''} onClick={() => onAccessModeChange('live')}>Live Test</button></div>
    <button className="portal-switcher-mobile" onClick={() => setCompactOpen(open => !open)}>
      <selected.icon/><span>{selected.label}</span>
    </button>
    <div className="portal-switcher-options">
      {options.map(option => {
        const Icon = option.icon
        return <button
          key={option.id}
          className={option.id === displayedRole ? 'active' : ''}
          disabled={accessMode === 'live' && option.id !== actualRole}
          title={accessMode === 'live' && option.id !== actualRole ? 'Live Test uses the authenticated account role' : undefined}
          onClick={() => { if (accessMode === 'live' && option.id !== actualRole) return; onChange(option.id); setCompactOpen(false) }}
        ><Icon/><span>{option.label}</span></button>
      })}
    </div>
    <div className="portal-switcher-actions"><button className="portal-switcher-signout" onClick={onSignOut} title="Sign out"><LogOut/><span>Sign Out</span></button><button className="portal-switcher-exit" onClick={onExit} title="Exit developer mode"><X/><span>Exit</span></button></div>
  </div>
}
