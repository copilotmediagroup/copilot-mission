# AI Compliance Underwriter
Production Edge Function is deployed through Supabase. It requires `OPENAI_API_KEY` as a server-side Edge Function secret.

Flow: private agency document -> objective fact extraction -> deterministic compliance checks -> auditable recommendation (`approved`, `action_required`, or `manual_review`). AI does not inspect or infer protected traits and does not autonomously change an agency's marketplace standing.
