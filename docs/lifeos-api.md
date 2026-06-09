# LifeOS AI API

## Implemented MVP Endpoints

- `GET /api/life-score`: dashboard snapshot with Life Score, goals, probabilities, schedule, assistant, coaching, interferences, and intervention.
- `POST /api/goal`: create a goal.
- `GET /api/goal`: list goals with probabilities.
- `POST /api/assistant`: update assistant persona fields.
- `POST /api/assistant/avatar`: upload an assistant avatar to Supabase Storage when configured.
- `POST /api/analyze`: run Life Score, goal probability, habit interference, coaching, and intervention analysis.
- `GET /api/schedule`: read generated schedule.
- `POST /api/schedule`: generate schedule from work and sleep windows.
- `POST /api/coach`: return OpenAI coaching JSON, falling back to rule-based coaching.
- `POST /api/intervention`: evaluate push intervention decision.
- `POST /api/intervention/deliver`: create an intervention notification and attempt FCM push delivery.
- `GET /api/realtime/lifeos`: return the user-specific Supabase Realtime channel and broadcast event contract.
- `POST /api/jobs/lifeos-daily-analysis`: cron-protected daily analysis job for Edge Functions and schedulers.
- `POST /api/behavior-log`: ingest mobile/manual behavior data and return recalculated score signals.
- `POST /api/mobile/behavior-sync`: ingest native mobile batches from Android Usage Stats, Android Health Connect, iOS Screen Time, and iOS HealthKit sample contracts.
- `GET /api/billing/plans`: return FREE, PREMIUM, VIP plan definitions.
- `POST /api/billing/checkout`: create a Stripe checkout session when Stripe is configured.
- `GET /api/auth/providers`: return Email, Google, and Apple provider availability.
- `GET|POST|DELETE /api/auth/lifeos`: local email-session contract backed by signed HTTP-only JWT cookies.
- `POST /api/auth/oauth`: create a Supabase OAuth URL for Google or Apple when configured.
- `GET /api/i18n/lifeos`: return Korean or English UI messages.
- `GET /api/health`: health and integration readiness status.
- `GET /api/calendar/export`: export the generated schedule as an ICS calendar file.
- `POST /api/calendar/sync`: Google/Apple calendar write boundary with deterministic fallback.
- `GET|POST /api/notifications`: list or create intervention notification records.
- `GET|POST /api/push-token`: list redacted device tokens or register an FCM token for web, iOS, or Android.
- `POST /api/character/reward`: award assistant experience and return character reward metadata.

## External Integrations

- Supabase is selected when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
- Supabase Storage uses the `assistant-avatars` bucket for assistant avatar uploads.
- OpenAI is used when `OPENAI_API_KEY` exists; requests fall back after timeout/failure.
- FCM push delivery uses registered `push_tokens` and requires `FIREBASE_SERVER_KEY`; without credentials it returns an explicit fallback reason.
- Push token API responses mask token values and never expose the server-side token fingerprint. Tokens are encrypted at rest when `LIFEOS_ENCRYPTION_KEY` is configured.
- Stripe checkout requires `STRIPE_SECRET_KEY`.
- OAuth providers require Supabase Auth provider setup and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Calendar export returns ICS immediately; Google/Apple calendar write APIs require account OAuth consent and provider credentials.

## Mobile Behavior Sync Payload

`POST /api/mobile/behavior-sync`

```json
{
  "device": {
    "platform": "android",
    "timezone": "Asia/Seoul"
  },
  "samples": [
    {
      "source": "usage_stats",
      "metric": "app_usage_minutes",
      "category": "youtube",
      "appName": "YouTube",
      "value": 18,
      "unit": "minutes",
      "capturedAt": "2026-05-31T00:00:00.000Z"
    },
    {
      "source": "health_connect",
      "metric": "steps",
      "value": 2400,
      "unit": "count",
      "capturedAt": "2026-05-31T00:00:00.000Z"
    }
  ]
}
```

The API stores normalized `behavior_logs` only. Raw app names are used for category classification and are not persisted by the current repository contract.
