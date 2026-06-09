# LifeOS Supabase Edge Functions

## `lifeos-daily-analysis`

Runs the daily LifeOS analysis job from Supabase Edge Functions or Supabase Scheduler.

Required secrets:

```bash
supabase secrets set LIFEOS_APP_BASE_URL=https://<deployment-host>
supabase secrets set LIFEOS_CRON_SECRET=<same-value-as-next-env>
```

Deploy:

```bash
supabase functions deploy lifeos-daily-analysis --project-ref <project-ref>
```

Invoke manually:

```bash
curl -X POST https://<project-ref>.functions.supabase.co/lifeos-daily-analysis
```

The function calls `POST /api/jobs/lifeos-daily-analysis`, which performs the Life Score analysis, probability refresh, intervention evaluation, FCM delivery attempt, and Supabase Realtime broadcast.
