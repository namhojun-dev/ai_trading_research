# LifeOS AI Production Runbook

This runbook turns the local MVP into a credentialed production deployment. Run the deterministic checks after each integration so a failing provider does not hide a core app regression.

## 1. Baseline

Use the WSL Node runtime for this workspace.

```bash
export PATH=/home/lunan/.nvm/versions/node/v22.22.2/bin:$PATH
npm ci
npx tsc --noEmit
npm run build
```

Start a local verification server:

```bash
./scripts/start-lifeos-dev.sh 3200
LIFEOS_BASE_URL=http://127.0.0.1:3200 npm run test:lifeos
```

## 2. Supabase

Create a Supabase project, run `backend/database/schema.sql`, then set:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
LIFEOS_DEMO_USER_ID=
LIFEOS_APP_BASE_URL=
LIFEOS_CRON_SECRET=
```

Enable Google and Apple providers in Supabase Auth before testing `/api/auth/oauth`.

The SQL also creates the public `assistant-avatars` Storage bucket used by `POST /api/assistant/avatar`.

Deploy the Edge Function after setting Supabase function secrets:

```bash
supabase secrets set LIFEOS_APP_BASE_URL=https://<deployment-host>
supabase secrets set LIFEOS_CRON_SECRET=<same-value-as-next-env>
supabase functions deploy lifeos-daily-analysis --project-ref <project-ref>
```

## 3. Security

Set production-only secrets:

```txt
LIFEOS_JWT_SECRET=
LIFEOS_ENCRYPTION_KEY=
```

Use 32+ random bytes for each secret. Rotate immediately if a local `.env.local` is ever shared.

`LIFEOS_ENCRYPTION_KEY` is used for sensitive token-at-rest encryption. Keep it stable across deployments so encrypted FCM device tokens remain readable.

## 4. OpenAI

Set:

```txt
OPENAI_API_KEY=
OPENAI_LIFEOS_MODEL=gpt-5-mini
LIFEOS_ENABLE_OPENAI_COACHING=true
```

If latency is high, keep `LIFEOS_ENABLE_OPENAI_COACHING=false` for launch and rely on the rule-based coaching fallback.

## 5. Stripe

Create FREE, PREMIUM, and VIP products/prices in Stripe, set:

```txt
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Configure the webhook endpoint:

```txt
POST https://<deployment-host>/api/billing/webhook
```

Required event:

```txt
checkout.session.completed
```

The webhook stores subscription state when Supabase is configured.

## 6. Firebase Cloud Messaging

Set:

```txt
FIREBASE_SERVER_KEY=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

Register device tokens through `POST /api/push-token`, then verify `POST /api/intervention/deliver`.

Use `GET /api/realtime/lifeos` to retrieve the Supabase channel contract for live dashboard or mobile subscriptions.

## 7. Calendar

Use `GET /api/calendar/export` as the baseline fallback. For direct Google Calendar writes, pass a user OAuth access token to `POST /api/calendar/sync` with:

```json
{
  "provider": "google",
  "accessToken": "<user-oauth-token>",
  "calendarId": "primary"
}
```

Apple Calendar direct write should be handled by user-side ICS import or a future CalDAV connector.

## 8. Mobile

Configure Expo with:

```txt
EXPO_PUBLIC_LIFEOS_API_BASE_URL=https://<deployment-host>
EXPO_PUBLIC_LIFEOS_DEMO_SYNC=false
```

Native modules should convert Android Usage Stats, Android Health Connect, iOS Screen Time, and iOS HealthKit samples into the `MobileBehaviorSample` contract in `apps/mobile/src/lifeosApi.ts`, then call `POST /api/mobile/behavior-sync`.

## 9. Deployment Gates

Before promoting a build:

```bash
npx tsc --noEmit
npm run build
LIFEOS_BASE_URL=https://<deployment-host> npm run test:lifeos
```

The smoke suite currently covers the root app, health, Life Score, analysis, goal creation, manual behavior ingestion, mobile behavior sync, schedule generation, coaching contract, billing boundaries, auth boundaries, calendar export/sync, notifications, push tokens, intervention delivery, character rewards, email session, and i18n.
