import { supabase } from '../../lib/supabase'

export type MaverickPaymentConfig = {
  processor: 'maverick_easy_pay_direct'
  configured: boolean
  publicKey: string
  collectJsUrl: string
}

export type MaverickPaymentResult = {
  approved: boolean
  status: 'authorized' | 'captured' | 'declined'
  message: string
  transactionId?: string
  authCode?: string
  amountCents: number
  processor: 'maverick_easy_pay_direct'
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function getMaverickPaymentConfig() {
  const { data, error } = await db().functions.invoke('maverick-payment-config', { method: 'GET' })
  if (error) throw new Error(error.message)
  return data as MaverickPaymentConfig
}

export async function authorizeMaverickJobPayment(input: {
  jobId: string
  paymentToken: string
  action?: 'auth' | 'sale'
  billing?: {
    cardholderName?: string
    address1?: string
    city?: string
    state?: string
    zip?: string
    email?: string
    phone?: string
  }
}) {
  const { data, error } = await db().functions.invoke('maverick-payments', {
    body: {
      jobId: input.jobId,
      paymentToken: input.paymentToken,
      action: input.action ?? 'auth',
      billing: input.billing ?? {},
    },
  })
  if (error) throw new Error(error.message)
  return data as MaverickPaymentResult
}

export async function loadCollectJs(publicKey: string, collectJsUrl = 'https://secure.nmi.com/token/Collect.js') {
  if (!publicKey) throw new Error('Maverick public key is not configured.')
  if (document.querySelector(`script[data-maverick-collect-js="true"]`)) return
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = collectJsUrl
    script.async = true
    script.dataset.maverickCollectJs = 'true'
    script.dataset.tokenizationKey = publicKey
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Maverick payment fields.'))
    document.head.appendChild(script)
  })
}
