# LifeOS AI Architecture
LifeOS AI is designed as an AI life operating system, not a habit checklist. The MVP computes Life Score, goal completion probability, habit interference, AI schedule blocks, coaching output, and real-time intervention decisions from behavior data.

## Current Implementation

- UI: `src/app/page.tsx`
- Web app path: `apps/web/package.json` proxies root Next.js commands during the monorepo transition.
- API routes: `src/app/api/life-score`, `goal`, `assistant`, `analyze`, `schedule`, `coach`, `intervention`, `push-token`, `mobile/behavior-sync`
- Shared packages: `packages/ui`, `packages/types`, `packages/utils`, `packages/ai`
- Domain contracts: `src/features/lifeos/domain`
- Application services and engines: `src/features/lifeos/application`
- Repository adapter: `src/features/lifeos/infrastructure`
- Supabase schema: `backend/database/schema.sql`

## Clean Architecture Boundaries

- Domain layer defines entities and repository ports.
- Application layer owns business rules: Life Score, goal probability, habit removal, schedule generation, coaching, and intervention.
- Infrastructure layer provides repository implementations. Local development uses seed data; production uses `SupabaseLifeOSRepository` when Supabase env vars are present.
- API routes are thin controllers. They validate input, call `LifeOSService`, and return stable JSON contracts.

## Rule-Based Engines

The first release intentionally uses deterministic scoring:

- Life Score weighs exercise, sleep, focus, distractions, and recovery.
- Goal probability combines Life Score, goal priority, deadline pressure, and behavior alignment.
- Habit removal ranks SNS, video, game time, sleep debt, and late-night snacks by goal impact.
- Intervention fires when behavior crosses a risk threshold, such as YouTube over 80 minutes.

This keeps the MVP explainable and leaves a clean path for ML models later.

## Next Build Steps

1. Configure Supabase env vars and run `backend/database/schema.sql`.
2. Add Supabase Auth providers for Google, Apple, and email.
3. Replace the Expo demo collector with native mobile modules for Usage Stats API, Health Connect, Screen Time API, and HealthKit.
4. Configure Firebase credentials and mobile/web client token registration in deployed environments.
5. Configure Stripe webhook signing and Supabase credentials for durable subscription state after checkout creation.

## Production Boundaries Added

- Supabase adapter: `SupabaseLifeOSRepository`, selected automatically when server Supabase env vars exist.
- Supabase Storage: `/api/assistant/avatar` uploads assistant avatars to the `assistant-avatars` bucket when configured.
- OpenAI coaching adapter: `generateAICoaching`, enabled by `LIFEOS_ENABLE_OPENAI_COACHING=true`, with strict JSON schema and deterministic fallback.
- Rate limiting: `applyRateLimit` on mutation and AI endpoints.
- JWT session helper: `createLifeOSJwt` and `verifyLifeOSJwt` for HTTP-only email login cookies.
- I18n messages: Korean and English message contract under `/api/i18n/lifeos`.
- Calendar sync: Google Calendar event insertion when an access token/calendar id are supplied, plus Apple-compatible `.ics` export.
- FCM push token registry: `GET|POST /api/push-token` backed by `push_tokens`.
- Mobile behavior sync: `/api/mobile/behavior-sync` normalizes platform samples into durable `behavior_logs`.
- Life Score persistence: daily score upsert through the repository port into `life_scores`.
- Intervention delivery boundary: `/api/intervention/deliver` stores notification records and attempts FCM delivery.
- Supabase Realtime boundary: `/api/realtime/lifeos` exposes the user channel and `/api/intervention/deliver` broadcasts `intervention.created` when configured.
- Supabase Edge Function scaffold: `backend/functions/lifeos-daily-analysis` calls the cron-protected `/api/jobs/lifeos-daily-analysis` endpoint for scheduled analysis and intervention refresh.
- Plan entitlement enforcement: FREE goal limit is enforced in the service layer before goal creation.
- Health endpoint: integration readiness under `/api/health`.
- Privacy encryption helper: AES-256-GCM helpers for secrets and sensitive user-linked tokens.
- Push token privacy: FCM tokens are encrypted at rest when `LIFEOS_ENCRYPTION_KEY` is set, deduplicated by a token fingerprint, and exposed only as masked values through API responses.
- Stripe webhook boundary: `/api/billing/webhook` validates Stripe signatures and persists subscription rows when configured.
- CI/CD: GitHub Actions typecheck and build workflow.
- Docker: production image definition for deploy targets that need containers.
