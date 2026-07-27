import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePortfolioStore } from './PortfolioStore';
import { useAgencyStore } from './AgencyStore';

export type DeliveryMethod='download'|'email';
export type DistributionStatus='prepared'|'downloaded'|'sent'|'locked';
export interface DistributionRecord{
  id:string; portfolioId:string; portfolioName:string; fileId:string; fileName:string; fileVersion:number;
  agencyId:string; agencyName:string; contactId:string; contactName:string; contactEmail:string;
  employeeId:string; employeeName:string; method:DeliveryMethod; reason:string; status:DistributionStatus;
  createdAt:string; deliveredAt?:string; followUpAt:string; riskFlags:string[];
}
interface Store{
  distributions:DistributionRecord[];
  createDistribution:(input:{agencyId:string;contactId:string;method:DeliveryMethod;reason:string;followUpAt:string})=>{ok:boolean;message:string;record?:DistributionRecord};
  markDelivered:(id:string)=>void;
  lockDistribution:(id:string)=>void;
  alreadySent:(portfolioId:string,agencyId:string,contactId:string)=>DistributionRecord[];
  activeFileLocked:boolean;
}
const KEY='dmh-sales-os-distributions-v050';
const Context=createContext<Store|null>(null);
export function DistributionProvider({children}:{children:ReactNode}){
  const {active}=usePortfolioStore();
  const {agencies,currentEmployee,addActivity}=useAgencyStore();
  const [distributions,setDistributions]=useState<DistributionRecord[]>(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}});
  useEffect(()=>localStorage.setItem(KEY,JSON.stringify(distributions)),[distributions]);
  const alreadySent=(portfolioId:string,agencyId:string,contactId:string)=>distributions.filter(d=>d.portfolioId===portfolioId&&d.agencyId===agencyId&&d.contactId===contactId&&d.status!=='locked');
  const createDistribution:Store['createDistribution']=(input)=>{
    if(!active)return{ok:false,message:'There is no active portfolio available for distribution.'};
    if(!active.file)return{ok:false,message:'The active portfolio has no approved masked file.'};
    if(['reserved','payment_pending','sold'].includes(active.status))return{ok:false,message:'Distribution is locked while this portfolio is reserved, pending payment, or sold.'};
    const agency=agencies.find(a=>a.id===input.agencyId); if(!agency)return{ok:false,message:'Select an agency.'};
    if(agency.ownerEmployeeId!==currentEmployee.id)return{ok:false,message:'This agency is protected by another employee.'};
    const contact=agency.contacts.find(c=>c.id===input.contactId); if(!contact)return{ok:false,message:'Select a verified recipient.'};
    if(!contact.email&&input.method==='email')return{ok:false,message:'This contact does not have an email address.'};
    const previous=alreadySent(active.id,agency.id,contact.id);
    const riskFlags:string[]=[];
    if(previous.length)riskFlags.push('Repeat recipient');
    if(distributions.filter(d=>d.employeeId===currentEmployee.id&&new Date(d.createdAt).toDateString()===new Date().toDateString()).length>=10)riskFlags.push('High daily volume');
    const record:DistributionRecord={id:crypto.randomUUID(),portfolioId:active.id,portfolioName:active.name,fileId:active.file.id,fileName:active.file.name,fileVersion:1,agencyId:agency.id,agencyName:agency.name,contactId:contact.id,contactName:`${contact.firstName} ${contact.lastName}`,contactEmail:contact.email,employeeId:currentEmployee.id,employeeName:currentEmployee.name,method:input.method,reason:input.reason,status:'prepared',createdAt:new Date().toISOString(),followUpAt:input.followUpAt,riskFlags};
    setDistributions(s=>[record,...s]);
    addActivity(agency.id,{type:'note',disposition:'Requested portfolio',notes:`Masked portfolio prepared for ${record.contactName} by ${record.employeeName}.`,followUpAt:input.followUpAt});
    return{ok:true,message:previous.length?'Distribution prepared. Warning: this recipient has received this portfolio before.':'Distribution prepared and permanently attributed.',record};
  };
  const markDelivered=(id:string)=>setDistributions(s=>s.map(d=>d.id===id?{...d,status:d.method==='email'?'sent':'downloaded',deliveredAt:new Date().toISOString()}:d));
  const lockDistribution=(id:string)=>setDistributions(s=>s.map(d=>d.id===id?{...d,status:'locked'}:d));
  const value=useMemo<Store>(()=>({distributions,createDistribution,markDelivered,lockDistribution,alreadySent,activeFileLocked:Boolean(active&&['reserved','payment_pending','sold'].includes(active.status))}),[distributions,active,agencies]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useDistributionStore(){const x=useContext(Context);if(!x)throw new Error('DistributionProvider missing');return x}
