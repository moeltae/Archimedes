# Archimedes — Active Development

## Pipeline Status

| Component | Status | Detail |
|-----------|--------|--------|
| BioRxiv ingestion | ✅ Working | Real API call, seeds correctly. No UI trigger — must call `/api/seed` directly |
| Paper claim extraction | ✅ Working | GPT-4o, markdown-fence-safe parser |
| Study generation | ✅ Working | GPT-4o, produces tags constrained to SCIENCE_FIELDS |
| Study → Experiments decomposition | ✅ Working | Creates 3-5 experiments per study, wired into seed + generate + submit flows |
| FutureHouse | ✅ Working | Real Edison Platform API (OWL for precedent, CROW for literature). Falls back to OpenAI if key missing |
| Novelty checking | ✅ Working | Full flow: DB text search → FutureHouse (or OpenAI fallback) → create if score ≥ 5 |
| Voting | ✅ Working | Toggle on/off, switch vote, new vote — all three cases handled |
| Funding | ⚠️ Cosmetic | Updates DB `funded_amount`, no real payment. Room left for Stripe |
| Search | ⚠️ Client-side only | Filters fetched studies in JS. No server-side search endpoint |
| Tag filtering | ✅ Working | Supabase `.contains()` on JSONB array, sidebar wired |
| Supabase client | ⚠️ Anon only | Single public client, no service-role key. Fine for demo |

---

## What Needs Work

### 1. ~~FutureHouse Integration~~ ✅ Done
- `src/lib/futurehouse.ts` now uses the real Edison Platform REST API
- Auth: `POST /auth/login` with API key → JWT, then `POST /v0.1/crows` + poll `GET /v0.1/trajectories/:id`
- OWL agent (`job-futurehouse-paperqa3-precedent`) for novelty/precedent checking
- CROW agent (`job-futurehouse-paperqa3`) for literature grounding
- Still falls back to OpenAI if `FUTUREHOUSE_API_KEY` is not set

### 2. Live Seed UI (No way to trigger from app)
- `/api/seed` endpoint works but requires a direct POST with `SEED_SECRET`
- Need a UI button or auto-run demo mode so judges can watch studies populate in real-time
- Could be a "Generate Studies" button in the feed or an auto-polling mechanism

### 3. Search (Client-side only)
- `SearchContext` filters already-fetched studies in the browser
- No server-side search API — fine for 20 studies, won't scale
- Could add a Supabase full-text search endpoint using the existing `fts` column on `experiments` table

### 4. Simulated Results View (Not built)
- No UI for showing experiment results, figures, or draft reports on completed studies
- Demo flow calls for this as the final step: AI analyzes data → generates report
- Needs a results section on the study detail page

---

## TODO

### Frontend
#### High Impact
- [ ] Live auto-generation UI — button that triggers BioRxiv ingestion with real-time feed updates
- [ ] Simulated results view — results, figures, and draft report on completed studies
- [ ] Search — move to server-side or keep client-side but ensure it works well

#### Nice to Have
- [ ] Lab signup / claim experiment button on study detail page
- [ ] Funding cost breakdown per experiment
- [ ] Mobile responsiveness

### Backend / Technical
#### High Impact
- [x] Wire up real FutureHouse API — Edison Platform REST API with OWL + CROW agents
- [ ] Live auto-generation pipeline — background job or endpoint for continuous BioRxiv ingestion

#### Nice to Have
- [ ] AI-generated draft research report for completed studies
- [ ] Real payment integration (Stripe) — currently cosmetic
- [ ] Rate limiting / abuse prevention on public API routes
- [ ] Server-side Supabase client with service-role key for API routes
