import { useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from './AuthProvider'

type View = 'login' | 'signup' | 'forgot'

export function AuthGateway({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.phase === 'booting' || auth.phase === 'profile_loading') return <AuthSplash label={auth.phase === 'profile_loading' ? 'Loading your secure workspace…' : 'Securing your session…'} />
  if (auth.phase === 'connection_error') return <StateScreen icon={<AlertTriangle/>} title="Connection problem" body={auth.error ?? 'Unable to reach Co Pilot.'} action={<button onClick={() => void auth.retry()}><RefreshCw/>Retry</button>} />
  if (auth.phase === 'profile_missing') return <StateScreen icon={<AlertTriangle/>} title="Account setup incomplete" body="Your login is valid, but its Co Pilot profile is missing. Contact platform support." action={<button onClick={() => void auth.signOut()}>Sign out</button>} />
  if (auth.phase === 'signed_out') return <AuthScreen />
  if (auth.status !== 'approved') {
    const copy = auth.status === 'pending' ? ['Approval pending', auth.role === 'agency_admin' ? 'Your agency is under platform review. We’ll notify you after approval.' : auth.role === 'guard' ? 'Your agency has not activated your guard account yet.' : 'Your account is being reviewed.'] : auth.status === 'rejected' ? ['Account not approved','This account was not approved. Contact platform support for help.'] : ['Account disabled','Access to this account has been disabled. Contact platform support.']
    return <StateScreen icon={<ShieldCheck/>} title={copy[0]} body={copy[1]} action={<button onClick={() => void auth.signOut()}>Sign out</button>} />
  }
  return <>{children}</>
}

function AuthSplash({ label }: { label: string }) { return <div className="auth-splash"><div className="auth-mark"><ShieldCheck/></div><h1>CO PILOT</h1><p>Security Marketplace</p><div className="auth-loader"><span/></div><small>{label}</small></div> }

function StateScreen({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action: ReactNode }) { return <div className="auth-state"><div className="auth-state-card"><div className="auth-state-icon">{icon}</div><h1>{title}</h1><p>{body}</p>{action}</div></div> }

function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [view,setView] = useState<View>('login'); const [showPassword,setShowPassword]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const [accountType,setAccountType]=useState<'client'|'agency_admin'>('client')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage(''); const form = new FormData(event.currentTarget)
    if (view === 'login') { const { error } = await signIn(String(form.get('email')), String(form.get('password'))); if (error) setMessage(error.message) }
    else if (view === 'signup') { const result = await signUp({ email:String(form.get('email')), password:String(form.get('password')), fullName:String(form.get('fullName')), accountType, agencyName:String(form.get('agencyName') ?? '') }); setMessage(result.error?.message ?? (result.needsEmailConfirmation ? 'Check your email to confirm your account.' : 'Account created.')) }
    else setMessage('Password recovery will be enabled after the Supabase email template is configured.')
    setBusy(false)
  }
  return <div className="auth-page">
    <section className="auth-visual"><div className="auth-grid"/><div className="auth-brand"><div className="auth-brand-mark"><ShieldCheck/></div><span>CO PILOT</span></div><div className="auth-pitch"><span className="auth-eyebrow">SECURITY MARKETPLACE</span><h1>One secure command layer for every mission.</h1><p>Connect clients, agencies and guards through a professional, real-time operations platform.</p><div className="auth-signal"><i/><span>Marketplace network ready</span></div></div></section>
    <section className="auth-panel"><div className="auth-form-wrap">
      {view !== 'login' && <button className="auth-back" onClick={() => {setView('login');setMessage('')}}><ArrowLeft/>Back to sign in</button>}
      <div className="auth-mobile-brand"><ShieldCheck/><span>CO PILOT</span></div>
      <span className="auth-kicker">SECURE ACCESS</span><h2>{view === 'login' ? 'Welcome back' : view === 'signup' ? 'Create your account' : 'Reset your password'}</h2><p className="auth-subtitle">{view === 'login' ? 'Sign in to continue to your protected workspace.' : view === 'signup' ? 'Choose how you will use the marketplace.' : 'Enter your account email to continue.'}</p>
      {view === 'signup' && <div className="auth-account-types"><button type="button" className={accountType==='client'?'active':''} onClick={()=>setAccountType('client')}><UserRound/><b>Client</b><small>Request security</small></button><button type="button" className={accountType==='agency_admin'?'active':''} onClick={()=>setAccountType('agency_admin')}><Building2/><b>Agency</b><small>Provide coverage</small></button></div>}
      <form onSubmit={submit}>
        {view === 'signup' && <label>Full name<div className="auth-input"><UserRound/><input name="fullName" required autoComplete="name" placeholder="Your full name"/></div></label>}
        {view === 'signup' && accountType === 'agency_admin' && <label>Agency name<div className="auth-input"><Building2/><input name="agencyName" required placeholder="Legal agency name"/></div></label>}
        <label>Email address<div className="auth-input"><Mail/><input name="email" type="email" required autoComplete="email" placeholder="name@company.com"/></div></label>
        {view !== 'forgot' && <label>Password<div className="auth-input"><LockKeyhole/><input name="password" type={showPassword?'text':'password'} minLength={8} required autoComplete={view==='login'?'current-password':'new-password'} placeholder="Enter your password"/><button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>}
        {view === 'login' && <div className="auth-options"><label className="auth-remember"><input type="checkbox"/>Remember me</label><button type="button" onClick={()=>{setView('forgot');setMessage('')}}>Forgot password?</button></div>}
        {message && <div className="auth-message"><CheckCircle2/>{message}</div>}
        <button className="auth-submit" disabled={busy}>{busy?<LoaderCircle className="spin"/>:null}{view==='login'?'Sign in':view==='signup'?'Create account':'Continue'}</button>
      </form>
      {view === 'login' && <div className="auth-create"><span>New to Co Pilot?</span><button onClick={()=>{setView('signup');setMessage('')}}>Create an account</button></div>}
      <div className="auth-security"><ShieldCheck/>Protected by encrypted session management</div>
    </div></section>
  </div>
}
