import { useEffect, useMemo, useState } from 'react'
import { Building2, Code2, Shield, ShieldCheck, UserRound, X } from 'lucide-react'
import type { AppRole } from './modules/auth/AuthProvider'

export type DeveloperPreview = AppRole | 'guard_lab'

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
}: {
  value: DeveloperPreview
  actualRole: AppRole | null
  onChange: (role: DeveloperPreview) => void
  onExit: () => void
}) {
  const [compactOpen, setCompactOpen] = useState(false)
  const selected = useMemo(() => options.find(option => option.id === value) ?? options[0], [value])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, value)
  }, [value])

  return <div className={`portal-switcher ${compactOpen ? 'mobile-open' : ''}`}>
    <div className="portal-switcher-brand"><Code2/><span>DEVELOPER MODE</span><small>Signed in as {actualRole?.replace('_', ' ') ?? 'user'}</small></div>
    <button className="portal-switcher-mobile" onClick={() => setCompactOpen(open => !open)}>
      <selected.icon/><span>{selected.label}</span>
    </button>
    <div className="portal-switcher-options">
      {options.map(option => {
        const Icon = option.icon
        return <button
          key={option.id}
          className={option.id === value ? 'active' : ''}
          onClick={() => { onChange(option.id); setCompactOpen(false) }}
        ><Icon/><span>{option.label}</span></button>
      })}
    </div>
    <button className="portal-switcher-exit" onClick={onExit} title="Exit developer mode"><X/><span>Exit</span></button>
  </div>
}
