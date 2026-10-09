import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from './modules/location/addressSearch'

type Target = { name:string; lat:number; lng:number; range:number; tilt:number }

const START: Target = { name:'Tampa', lat:27.9506, lng:-82.4572, range:6500, tilt:65 }
const TARGETS: Target[] = [
  { name:'Orlando', lat:28.5383, lng:-81.3792, range:6500, tilt:65 },
  { name:'Atlanta', lat:33.7490, lng:-84.3880, range:7000, tilt:65 },
  { name:'New York', lat:40.7128, lng:-74.0060, range:8500, tilt:65 },
  { name:'Los Angeles', lat:34.0522, lng:-118.2437, range:9000, tilt:65 },
]

export default function EarthFlightLab(){
  const hostRef=useRef<HTMLDivElement|null>(null)
  const mapRef=useRef<any>(null)
  const [status,setStatus]=useState('Loading Google Earth…')
  const [steady,setSteady]=useState(false)

  useEffect(()=>{
    let cancelled=false
    void (async()=>{
      try{
        const google=await loadGoogleMaps()
        const maps3d=await google.maps.importLibrary('maps3d')
        if(cancelled||!hostRef.current)return
        const {Map3DElement,Marker3DElement}=maps3d
        const map=new Map3DElement({
          center:{lat:START.lat,lng:START.lng,altitude:80},
          range:START.range,
          tilt:START.tilt,
          heading:0,
          mode:'SATELLITE',
          gestureHandling:'COOPERATIVE',
          defaultUIHidden:false,
        })
        map.style.width='100%';map.style.height='100%'
        hostRef.current.replaceChildren(map)
        mapRef.current=map
        const marker=new Marker3DElement({position:{lat:START.lat,lng:START.lng,altitude:80},label:'START · TAMPA',sizePreserved:true})
        map.append(marker)
        TARGETS.forEach(target=>map.append(new Marker3DElement({position:{lat:target.lat,lng:target.lng,altitude:80},label:target.name.toUpperCase(),sizePreserved:true})))
        map.addEventListener('gmp-steadychange',(event:any)=>{
          const isSteady=Boolean(event?.isSteady)
          setSteady(isSteady)
          if(isSteady)setStatus('Earth ready — choose a flight')
        })
        map.addEventListener('gmp-animationend',()=>setStatus('Flight complete'))
        map.addEventListener('gmp-error',(event:any)=>setStatus(`Earth error: ${event?.error?.message||'Map initialization failed'}`))
      }catch(error){setStatus(error instanceof Error?error.message:'Unable to initialize Google Earth')}
    })()
    return()=>{cancelled=true;mapRef.current?.stopCameraAnimation?.();mapRef.current=null}
  },[])

  const reset=()=>{
    const map=mapRef.current;if(!map)return
    map.stopCameraAnimation?.()
    map.center={lat:START.lat,lng:START.lng,altitude:80};map.range=START.range;map.tilt=START.tilt;map.heading=0
    setStatus('Reset to Tampa')
  }
  const fly=(target:Target)=>{
    const map=mapRef.current;if(!map||!steady)return
    map.stopCameraAnimation?.()
    setStatus(`Flying Tampa → ${target.name}…`)
    map.flyCameraTo({endCamera:{center:{lat:target.lat,lng:target.lng,altitude:80},range:target.range,tilt:target.tilt,heading:0},durationMillis:30000})
  }

  return <main className="earth-flight-lab">
    <header><div><b>CO PILOT</b><span>GOOGLE EARTH FLIGHT LAB</span></div><strong>{status}</strong></header>
    <section ref={hostRef} className="earth-flight-stage" />
    <nav>
      <button onClick={reset}>RESET · TAMPA</button>
      {TARGETS.map(target=><button key={target.name} disabled={!steady} onClick={()=>fly(target)}>LOCATE · {target.name.toUpperCase()}</button>)}
    </nav>
  </main>
}
