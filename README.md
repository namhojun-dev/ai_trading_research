# LifeOS AI

LifeOS AI is an AI assistant service that analyzes behavior data, calculates goal completion probability, detects blocking habits, generates schedules, and provides character-based coaching.

This repository currently contains a working Next.js MVP plus production integration boundaries for Supabase, OpenAI, FCM, Stripe, Docker, and GitHub Actions.

## Implemented

- LifeOS dashboard at `/`
- Rule-based Life Score engine
- Rule-based goal probability engine
- Habit interference ranking
- AI schedule generation
- AI coaching JSON contract with OpenAI fallback
- Realtime intervention decision API
- FCM push token registration and intervention delivery boundary
- Assistant persona and character growth data model
- Email-session API using HTTP-only signed JWT cookies
- Auth provider discovery for Email, Google, Apple
- Supabase repository adapter and SQL schema
- Stripe plan definitions: FREE, PREMIUM, VIP
- FCM push boundary
- i18n message API for Korean and English
- Rate limiting, encryption helper, health endpoint, structured logging
- Dockerfile and GitHub Actions CI
- Expo mobile scaffold
- Shared package entrypoints under `packages/ui`, `packages/types`, `packages/utils`, and `packages/ai`

## Run

Use the WSL Node runtime. Do not mix Windows Node/npm with this WSL worktree.

```bash
cd /home/lunan/workspace/ai_trading_research
PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH npm install
PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH npm run dev -- --hostname 0.0.0.0 --port 3200
```

Open:

```txt
http://127.0.0.1:3200
```

## Verify

```bash
PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH npm run build
PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH npm run test:lifeos
```

## Key APIs

- `GET /api/life-score`
- `POST /api/goal`
- `GET /api/goal`
- `POST /api/assistant`
- `POST /api/analyze`
- `GET|POST /api/schedule`
- `POST /api/coach`
- `POST /api/intervention`
- `POST /api/intervention/deliver`
- `GET /api/realtime/lifeos`
- `POST /api/jobs/lifeos-daily-analysis`
- `POST /api/behavior-log`
- `GET /api/billing/plans`
- `POST /api/billing/checkout`
- `GET /api/auth/providers`
- `GET|POST|DELETE /api/auth/lifeos`
- `POST /api/auth/oauth`
- `GET /api/i18n/lifeos`
- `GET /api/health`
- `GET /api/calendar/export`
- `POST /api/calendar/sync`
- `GET|POST /api/notifications`
- `GET|POST /api/push-token`
- `POST /api/mobile/behavior-sync`
- `POST /api/assistant/avatar`
- `POST /api/character/reward`

## Environment

Copy `.env.local.example` to `.env.local` and configure only the integrations you need.

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- OpenAI: `OPENAI_API_KEY`, `OPENAI_LIFEOS_MODEL`
- Security: `LIFEOS_ENCRYPTION_KEY`, `LIFEOS_JWT_SECRET`
- FCM: `FIREBASE_SERVER_KEY`, `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Architecture

LifeOS code is organized by Clean Architecture:

- Domain: `src/features/lifeos/domain`
- Application services and engines: `src/features/lifeos/application`
- Infrastructure adapters: `src/features/lifeos/infrastructure`
- Presentation: `src/features/lifeos/presentation`
- API routes: `src/app/api`
- Monorepo package entrypoints: `packages/*/package.json`

See:

- `docs/lifeos-architecture.md`
- `docs/lifeos-api.md`
- `docs/lifeos-production-runbook.md`
- `backend/database/schema.sql`
