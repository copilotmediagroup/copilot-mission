import assert from 'node:assert/strict'
import {resolveIntegrationTarget} from './integration-target.mjs'
const env={COPISEC_TEST_PROJECT_REF:'synthetic-test-project',COPISEC_TEST_SUPABASE_URL:'https://synthetic-test-project.supabase.co',COPISEC_TEST_FIXTURES_ONLY:'true',COPISEC_TEST_SUPABASE_ANON_KEY:'test-only-publishable-placeholder',COPISEC_TEST_SUPABASE_SERVICE_KEY:'test-only-service-placeholder'}
assert.equal(resolveIntegrationTarget(env).processorMode,'stub')
for(const override of [{COPISEC_TEST_PROJECT_REF:'eznhyemkuxectndxtymc'},{COPISEC_TEST_SUPABASE_URL:'https://eznhyemkuxectndxtymc.supabase.co'},{COPISEC_TEST_SUPABASE_URL:'https://other-project.supabase.co'},{COPISEC_TEST_FIXTURES_ONLY:'false'},{COPISEC_TEST_PROCESSOR_MODE:'live'},{COPISEC_TEST_PROCESSOR_MODE:'sandbox'},{COPISEC_TEST_SUPABASE_URL:'https://user:secret@synthetic-test-project.supabase.co'},{COPISEC_TEST_SUPABASE_URL:'https://synthetic-test-project.supabase.co?key=secret'},{COPISEC_TEST_SUPABASE_SERVICE_KEY:''}])assert.throws(()=>resolveIntegrationTarget({...env,...override}))
assert.throws(()=>resolveIntegrationTarget({}))
assert.equal(resolveIntegrationTarget({...env,COPISEC_TEST_SUPABASE_URL:'http://127.0.0.1:54321'}).syntheticFixturesOnly,true)
console.log('PASS integration target gates: production/mismatched URLs, credentials in URLs, missing configuration, real fixtures and non-stub processors denied; zero network calls')
