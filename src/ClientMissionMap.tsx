import UnifiedMissionMap from './modules/maps/UnifiedMissionMap'
import type { ClientTrackingExperience } from './modules/client/clientLiveTrackingRepository'

type Props={experience:NonNullable<ClientTrackingExperience>;completed:boolean}
export default function ClientMissionMap({experience,completed}:Props){return <UnifiedMissionMap role="client" completed={completed} property={experience.property} guard={experience.guard}/>} 
