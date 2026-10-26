import {supabase} from '../../lib/supabase'

export async function requestMyAccountDeletion(){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.rpc('request_my_account_deletion')
  if(error)throw error
  return data
}
