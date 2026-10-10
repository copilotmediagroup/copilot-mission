export type MobileTarget='client'|'guard'|null

export function mobileTarget():MobileTarget{
  const target=(import.meta.env.VITE_MOBILE_TARGET||'').trim().toLowerCase()
  return target==='client'||target==='guard'?target:null
}

export function roleAllowedForMobile(role:string|null|undefined){
  const target=mobileTarget()
  return !target||(target==='client'?role==='client':role==='guard')
}

export function mobileProductName(){
  const target=mobileTarget()
  return target==='guard'?'CO PILOT GUARD':target==='client'?'CO PILOT SECURITY':'CO PILOT'
}
