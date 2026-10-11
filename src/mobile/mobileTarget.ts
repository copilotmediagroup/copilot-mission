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

export function configureMobileDocument(){
  const target=mobileTarget()
  if(!target)return
  document.title=target==='guard'?'CO PILOT GUARD':'CO PILOT SECURITY'
  document.documentElement.dataset.mobileTarget=target
  let theme=document.querySelector('meta[name="theme-color"]') as HTMLMetaElement|null
  if(!theme){theme=document.createElement('meta');theme.name='theme-color';document.head.appendChild(theme)}
  theme.content='#000000'
}
