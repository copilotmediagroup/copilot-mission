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
  paymentToken?: string
  useSavedCard?: boolean
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
      useSavedCard: input.useSavedCard ?? !input.paymentToken,
      action: input.action ?? 'auth',
      billing: input.billing ?? {},
    },
  })
  if (error) throw new Error(error.message)
  return data as MaverickPaymentResult
}

function waitForCollectJs(timeoutMs = 10000) {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      const collect = (window as any).CollectJS
      if (collect?.configure) { resolve(); return }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('Secure payment script loaded, but the tokenization key did not activate Collect.js. Confirm MAVERICK_PUBLIC_KEY is the Collect.js tokenization key.'))
        return
      }
      window.setTimeout(check, 150)
    }
    check()
  })
}

export async function loadCollectJs(publicKey: string, collectJsUrl = 'https://secure.nmi.com/token/Collect.js') {
  if (!publicKey) throw new Error('Maverick public key is not configured.')
  if ((window as any).CollectJS?.configure) return
  const existing = document.querySelector('script[data-maverick-collect-js="true"]') as HTMLScriptElement | null
  if (existing) {
    // A failed activation leaves a dead tag behind. Remove it so a corrected key can retry.
    existing.remove()
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = collectJsUrl
    script.async = true
    script.setAttribute('data-maverick-collect-js', 'true')
    script.setAttribute('data-tokenization-key', publicKey)
    script.setAttribute('data-variant', 'inline')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Maverick payment fields.'))
    document.head.appendChild(script)
  })
  await waitForCollectJs()
}

export async function saveMaverickPaymentMethod(paymentToken: string) {
  const { data, error } = await db().functions.invoke('maverick-billing', { body: { paymentToken } })
  if (error) throw new Error(error.message)
  if (!data?.saved) throw new Error(data?.message || 'Unable to save payment method.')
  return data as { saved: boolean; last4: string | null; brand: string | null }
}
