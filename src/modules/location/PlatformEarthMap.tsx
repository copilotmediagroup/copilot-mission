import EarthFlightLab from '../../EarthFlightLab'
import type { MissionMapMarker } from './MissionMap'

type Props={markers?:MissionMapMarker[];focusTarget?:{latitude:number;longitude:number}|null}

export default function PlatformEarthMap(_props:Props){
 return <EarthFlightLab/>
}
