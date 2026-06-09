# LifeOS AI Requirements Trace

This matrix maps the original product brief to current implementation evidence.

## Product Core

| Requirement | Current evidence | Status |
|---|---|---|
| Current life analysis | `LifeScoreEngine`, `/api/life-score`, dashboard analytics | Implemented |
| Goal completion probability | `GoalProbabilityEngine`, `/api/analyze`, dashboard goal cards | Implemented |
| Blocking habit detection | `HabitRemovalEngine`, `interferences` in snapshot | Implemented |
| Automatic schedule generation | `ScheduleEngine`, `/api/schedule`, `.ics` export | Implemented |
| Realtime intervention | `InterventionEngine`, `/api/intervention`, `/api/intervention/deliver` | Implemented with FCM boundary |
| Character coaching/growth | `Assistant`, `/api/assistant`, `/api/character/reward` | Implemented |

## Architecture Structure

| Requirement | Current evidence | Status |
|---|---|---|
| `/apps/web` | `apps/web/package.json`, root Next app proxy | Transition scaffold |
| `/apps/mobile` | Expo mobile shell and API sync adapter | Implemented |
| `/packages/ui` | `@lifeos/ui` entrypoint re-exporting shared UI primitives | Implemented |
| `/packages/types` | `@lifeos/types` shared LifeOS contracts | Implemented |
| `/packages/utils` | `@lifeos/utils` score/date/token helpers | Implemented |
| `/packages/ai` | `@lifeos/ai` prompt and engine metadata entrypoint | Implemented |
| `/backend/database` | Supabase SQL schema | Implemented |
| `/backend/functions` | Supabase Edge Function scaffold | Implemented |
| `/docs` | Architecture, API, audit, runbook, requirements trace | Implemented |

## MVP Features

| Area | Current evidence | Status |
|---|---|---|
| Google login | `/api/auth/providers`, `/api/auth/oauth` | Supabase boundary, needs provider env |
| Apple login | `/api/auth/providers`, `/api/auth/oauth` | Supabase boundary, needs provider env |
| Email login | `/api/auth/lifeos`, JWT cookie helpers | Implemented for local session |
| Assistant personas | `AssistantPersona`, dashboard persona selector | Implemented |
| Goal CRUD seed | `/api/goal` GET/POST | Create/list implemented |
| Behavior ingestion | `/api/behavior-log`, `/api/mobile/behavior-sync` | Implemented |
| Android/iOS data sources | `apps/mobile`, `BehaviorSource` contracts, mobile batch normalizer | Sync contract implemented; native permission modules require platform build |
| Life Score 0-100 | `LifeScoreEngine`, `life_scores` upsert through repository port | Implemented |
| Rule-based probability | `GoalProbabilityEngine` | Implemented |
| AI habit removal | `HabitRemovalEngine` | Implemented |
| AI schedule | `ScheduleEngine`, Google Calendar sync, Apple-compatible ICS export | Implemented |
| GPT coaching | `generateAICoaching` | Implemented behind `LIFEOS_ENABLE_OPENAI_COACHING=true` |
| Push intervention | `sendInterventionPush`, push token registry | Implemented; real send requires `FIREBASE_SERVER_KEY` |
| Character rewards | `/api/character/reward` | Implemented |

## Data And Integrations

| Requirement | Current evidence | Status |
|---|---|---|
| Supabase PostgreSQL schema | `backend/database/schema.sql`, `SupabaseLifeOSRepository` upserts daily Life Scores | Implemented |
| Supabase repository pattern | `SupabaseLifeOSRepository`, `LifeOSRepository` | Implemented |
| Auth/Auth providers | `/api/auth/*` | Boundary implemented |
| Storage | `/api/assistant/avatar`, `assistant-avatars` Supabase bucket | Boundary implemented |
| Edge Functions | `backend/functions/lifeos-daily-analysis`, `/api/jobs/lifeos-daily-analysis` | Implemented deployment scaffold |
| Realtime | `/api/realtime/lifeos`, intervention broadcast boundary | Implemented with Supabase Realtime boundary |
| OpenAI API | `openai-coaching.ts` | Implemented behind feature flag |
| Firebase Cloud Messaging | `intervention-push.ts`, `/api/push-token` | Boundary implemented |
| Stripe | `/api/billing/plans`, `/api/billing/checkout`, `/api/billing/webhook` | Boundary implemented; persistence active when Stripe/Supabase env vars exist |
| Vercel/Docker | `Dockerfile`, buildable Next app | Implemented |
| GitHub Actions | `.github/workflows` | Implemented |

## Non-Functional

| Requirement | Current evidence | Status |
|---|---|---|
| Dark mode | Global theme and dashboard UI | Implemented |
| Responsive | Dashboard grid/nav responsive classes | Implemented |
| Multilingual | `/api/i18n/lifeos` Korean/English contract | Implemented |
| Performance/caching | Static root, cached plan endpoint, thin API routes | Implemented for MVP |
| Error logging | `logLifeOSEvent` | Implemented |
| Rate limit | `applyRateLimit` on mutation/intervention endpoints | Implemented |
| JWT security | `src/lib/security/jwt.ts` | Implemented |
| Privacy encryption | `src/lib/security/crypto.ts`, encrypted FCM token-at-rest flow with non-exposed token hash | Implemented |

## Verification

Use WSL Linux Node, not Windows Node, because this repository lives under WSL:

```bash
PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH npm run build
PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH LIFEOS_BASE_URL=http://127.0.0.1:3200 npm run test:lifeos
```

Latest verified gates:

- `npx tsc --noEmit`
- `npm run build`
- `npm run test:lifeos` with 28 checks
