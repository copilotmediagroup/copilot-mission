import { ArrowRight, Building2, CheckCircle2, ExternalLink, Mail, Search, ShieldAlert } from 'lucide-react';
import { FormEvent, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Pill, PrimaryButton, SecondaryButton } from '../../components/Primitives';
import { useAgencyStore } from '../../store/AgencyStore';

const input='w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const emptyForm={name:'',website:'',phone:'',generalEmail:'',city:'',state:'',sourceUrl:''};

export default function ProspectMode(){
  const {duplicateCheck,createAgency}=useAgencyStore();
  const nav=useNavigate();
  const [step,setStep]=useState<'search'|'review'|'create'>('search');
  const [form,setForm]=useState(emptyForm);
  const [matches,setMatches]=useState<ReturnType<typeof duplicateCheck>>([]);

  function check(e:FormEvent){
    e.preventDefault();
    const result=duplicateCheck(form);
    setMatches(result);
    setStep(result.length?'review':'create');
  }

  function save(e:FormEvent){
    e.preventDefault();
    const agency=createAgency(form);
    nav(`/employee/agencies/${agency.id}`);
  }

  return <div className="mx-auto max-w-5xl p-5 md:p-8 lg:p-10">
    <header className="mb-8">
      <p className="text-sm font-semibold text-blue-600">Prospecting engine</p>
      <h2 className="mt-1 text-3xl font-semibold">Find the next buyer.</h2>
      <p className="mt-2 text-slate-500">Research externally. Return here to protect the relationship and build company intelligence.</p>
    </header>

    <div className="mb-7 grid grid-cols-3 gap-3">
      <Step n="1" label="Identify" active={step==='search'}/>
      <Step n="2" label="Verify" active={step==='review'}/>
      <Step n="3" label="Claim" active={step==='create'}/>
    </div>

    {step==='search'&&<form onSubmit={check}>
      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3">
          <Search className="text-blue-600"/>
          <div><h3 className="text-xl font-semibold">Duplicate check</h3><p className="text-sm text-slate-500">Identify the agency before creating a new relationship.</p></div>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Agency name"><input className={input} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
          <Field label="Website"><input className={input} type="url" value={form.website} onChange={e=>setForm({...form,website:e.target.value})} placeholder="https://agency.com"/></Field>
          <Field label="Main phone"><input className={input} type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(813) 555-0100"/></Field>
          <Field label="General email"><div className="relative"><Mail className="pointer-events-none absolute left-4 top-3.5 text-slate-400" size={17}/><input className={`${input} pl-11`} type="email" value={form.generalEmail} onChange={e=>setForm({...form,generalEmail:e.target.value})} placeholder="contact@agency.com"/></div></Field>
          <Field label="Source URL"><input className={input} type="url" value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})} placeholder="Google Maps or directory URL"/></Field>
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">Email is checked against existing agency addresses and decision-maker contacts before a new record can be claimed.</p>
        <div className="mt-7 flex justify-end"><PrimaryButton>Check agency <ArrowRight className="ml-2" size={17}/></PrimaryButton></div>
      </Card>
    </form>}

    {step==='review'&&<Card className="p-6 md:p-8">
      <div className="flex gap-3"><ShieldAlert className="text-amber-500"/><div><h3 className="text-xl font-semibold">Possible company match</h3><p className="mt-1 text-sm text-slate-500">Do not create a duplicate relationship.</p></div></div>
      <div className="mt-6 space-y-3">{matches.map(m=><div key={m.agency.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-3"><p className="font-semibold">{m.agency.name}</p><Pill tone={m.score>=80?'warning':'neutral'}>{Math.min(m.score,100)}% match</Pill></div><p className="mt-2 text-sm text-slate-500">Owned by {m.agency.ownerEmployeeName} · {m.reasons.join(' · ')}</p>{m.agency.generalEmail&&<p className="mt-1 text-sm text-slate-500">{m.agency.generalEmail}</p>}</div><SecondaryButton onClick={()=>nav(`/employee/agencies/${m.agency.id}`)}>Open existing</SecondaryButton></div></div>)}</div>
      <div className="mt-7 flex flex-wrap justify-between gap-3"><SecondaryButton onClick={()=>setStep('search')}>Edit search</SecondaryButton><PrimaryButton onClick={()=>setStep('create')}>This is a different agency</PrimaryButton></div>
    </Card>}

    {step==='create'&&<form onSubmit={save}>
      <Card className="p-6 md:p-8">
        <div className="flex gap-3"><CheckCircle2 className="text-emerald-600"/><div><h3 className="text-xl font-semibold">Claim new agency</h3><p className="mt-1 text-sm text-slate-500">Working ownership is protected for 30 days and renews with meaningful activity.</p></div></div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label="Agency name"><input className={input} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
          <Field label="Website"><input className={input} type="url" value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></Field>
          <Field label="Main phone"><input className={input} type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
          <Field label="General email"><input className={input} type="email" value={form.generalEmail} onChange={e=>setForm({...form,generalEmail:e.target.value})} placeholder="contact@agency.com"/></Field>
          <Field label="City"><input className={input} required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></Field>
          <Field label="State"><input className={input} required maxLength={2} value={form.state} onChange={e=>setForm({...form,state:e.target.value.toUpperCase()})}/></Field>
          <Field label="Source URL"><input className={input} type="url" value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/></Field>
        </div>
        <div className="mt-7 flex justify-end"><PrimaryButton><Building2 className="mr-2" size={18}/>Create and claim</PrimaryButton></div>
      </Card>
    </form>}

    <Card className="mt-6 flex items-center gap-4 p-5"><ExternalLink className="text-blue-600"/><div><p className="text-sm font-semibold">Research remains external</p><p className="mt-1 text-xs text-slate-500">Use Google, Maps, LinkedIn and licensing directories. This engine permanently stores what your team discovers.</p></div></Card>
  </div>
}

function Field({label,children}:{label:string;children:ReactNode}){return <label><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>}
function Step({n,label,active}:{n:string;label:string;active:boolean}){return <div className={`rounded-2xl border p-4 ${active?'border-blue-500 bg-blue-50':'border-slate-200 bg-white'}`}><p className="text-xs font-semibold text-slate-400">STEP {n}</p><p className="mt-1 font-semibold">{label}</p></div>}
