import {pathToFileURL} from 'node:url'
const productionRef='eznhyemkuxectndxtymc'
export function resolveIntegrationTarget(env){
 const ref=env.COPISEC_TEST_PROJECT_REF?.trim()
 const raw=env.COPISEC_TEST_SUPABASE_URL?.trim()
 if(!ref||!raw)throw Error('Isolated test project reference and URL are required.')
 if(ref===productionRef)throw Error('Production project is forbidden for integration fixtures.')
 const url=new URL(raw)
 if(url.hostname===productionRef+'.supabase.co')throw Error('Production Supabase URL is forbidden.')
 const local=['127.0.0.1','localhost','[::1]'].includes(url.hostname)
 if(!local&&(url.protocol!=='https:'||url.hostname!==ref+'.supabase.co'))throw Error('Test URL must match the explicitly selected isolated Supabase project.')
 if(local&&!['http:','https:'].includes(url.protocol))throw Error('Invalid local test protocol.')
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Use a clean Supabase base URL without credentials or query parameters.')
 if(env.COPISEC_TEST_FIXTURES_ONLY!=='true')throw Error('Synthetic-fixture-only mode is required.')
 if((env.COPISEC_TEST_PROCESSOR_MODE||'stub')!=='stub')throw Error('This preparation runner permits a stub processor only.')
 if(!env.COPISEC_TEST_SUPABASE_ANON_KEY||!env.COPISEC_TEST_SUPABASE_SERVICE_KEY)throw Error('Isolated project keys are missing; no credential values are printed.')
 return {projectRef:ref,url:url.origin,processorMode:'stub',syntheticFixturesOnly:true}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{resolveIntegrationTarget(process.env);console.log('PASS isolated integration target configuration; no network requests or mutations performed.')}
 catch(error){console.error('BLOCKED:',error.message);process.exitCode=1}
}
