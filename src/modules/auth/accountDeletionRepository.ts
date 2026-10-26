import {supabase} from '../../supabaseClient'

export async function requestMyAccountDeletion(){
  const {data,error}=await supabase.rpc('request_my_account_deletion')
  if(error)throw error
  return data
}
