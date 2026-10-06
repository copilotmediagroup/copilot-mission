const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const publicKey = Deno.env.get('MAVERICK_PUBLIC_KEY') || Deno.env.get('NMI_PUBLIC_KEY') || ''
  return new Response(JSON.stringify({
    processor: 'maverick_easy_pay_direct',
    configured: Boolean(publicKey),
    publicKey,
    collectJsUrl: 'https://secure.nmi.com/token/Collect.js',
  }), { headers: { ...cors, 'content-type': 'application/json' } })
})
