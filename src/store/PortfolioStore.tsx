import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuditEvent, Portfolio, PortfolioStatus, UserRole } from '../types/domain';

const KEY='dmh-sales-os-v020';
const seed: Portfolio[]=[{
  id:'demo-active', name:'SmartPay Leasing', originalCreditor:'SmartPay', category:'Lease-to-own', accountCount:7327,
  faceValue:1842200, askingPrice:12500, privateMinimum:10000, acquisitionCost:3663.5,
  description:'Seasoned lease-to-own accounts with nationwide coverage and a clean masked sample.',
  sellingPoints:['7,327 consumer accounts','Nationwide account coverage','Masked CSV available immediately'],
  status:'active', createdAt:new Date(Date.now()-86400000*5).toISOString(), activatedAt:new Date(Date.now()-86400000*4).toISOString(),
  file:{id:'demo-file',name:'SmartPay_Masked.csv',size:286720,type:'text/csv',uploadedAt:new Date(Date.now()-86400000*5).toISOString()}
}];

type State={portfolios:Portfolio[]; audit:AuditEvent[]; role:UserRole};
type Store=State & {
 setRole:(role:UserRole)=>void;
 createPortfolio:(input:Omit<Portfolio,'id'|'createdAt'|'status'>)=>Portfolio;
 updatePortfolio:(id:string,patch:Partial<Portfolio>)=>void;
 transition:(id:string,status:PortfolioStatus)=>{ok:boolean;message:string};
 removePortfolio:(id:string)=>void;
 active?:Portfolio;
};

const Context=createContext<Store|null>(null);
const legal:Record<PortfolioStatus,PortfolioStatus[]>={
 draft:['ready','archived'],ready:['draft','active','archived'],active:['negotiating','archived'],negotiating:['active','reserved'],reserved:['active','payment_pending'],payment_pending:['active','sold'],sold:['archived'],archived:[]
};
function load():State{try{const x=localStorage.getItem(KEY);if(x)return JSON.parse(x)}catch{}return {portfolios:seed,audit:[],role:'owner'}}
export function PortfolioProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<State>(load);
 useEffect(()=>localStorage.setItem(KEY,JSON.stringify(state)),[state]);
 const addAudit=(action:string,detail:string)=>({id:crypto.randomUUID(),action,detail,occurredAt:new Date().toISOString()});
 const createPortfolio:Store['createPortfolio']=(input)=>{
  const p:Portfolio={...input,id:crypto.randomUUID(),createdAt:new Date().toISOString(),status:'draft'};
  setState(s=>({...s,portfolios:[p,...s.portfolios],audit:[addAudit('portfolio.created',`${p.name} created as Draft`),...s.audit]})); return p;
 };
 const updatePortfolio=(id:string,patch:Partial<Portfolio>)=>setState(s=>({...s,portfolios:s.portfolios.map(p=>p.id===id?{...p,...patch}:p),audit:[addAudit('portfolio.updated',`Portfolio record ${id} updated`),...s.audit]}));
 const transition:Store['transition']=(id,status)=>{
  const current=state.portfolios.find(p=>p.id===id); if(!current)return {ok:false,message:'Portfolio not found.'};
  if(!legal[current.status].includes(status))return {ok:false,message:`${current.status} cannot move directly to ${status}.`};
  if(status==='ready'&&!current.file)return {ok:false,message:'Upload a masked CSV before marking this portfolio Ready.'};
  if(status==='active'&&state.portfolios.some(p=>p.id!==id&&['active','negotiating','reserved','payment_pending'].includes(p.status)))return {ok:false,message:'Another portfolio is already active. Close or archive it first.'};
  setState(s=>({...s,portfolios:s.portfolios.map(p=>p.id===id?{...p,status,activatedAt:status==='active'?new Date().toISOString():p.activatedAt}:p),audit:[addAudit(`portfolio.${status}`,`${current.name} moved from ${current.status} to ${status}`),...s.audit]}));
  return {ok:true,message:`${current.name} is now ${status}.`};
 };
 const removePortfolio=(id:string)=>setState(s=>({...s,portfolios:s.portfolios.filter(p=>p.id!==id),audit:[addAudit('portfolio.deleted',`Draft portfolio ${id} removed`),...s.audit]}));
 const value=useMemo<Store>(()=>({...state,setRole:(role)=>setState(s=>({...s,role})),createPortfolio,updatePortfolio,transition,removePortfolio,active:state.portfolios.find(p=>['active','negotiating','reserved','payment_pending'].includes(p.status))}),[state]);
 return <Context.Provider value={value}>{children}</Context.Provider>
}
export function usePortfolioStore(){const x=useContext(Context);if(!x)throw new Error('PortfolioProvider missing');return x}
