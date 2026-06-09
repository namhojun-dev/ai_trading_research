# LifeOS AI Mobile

React Native Expo shell for the LifeOS mobile companion. It reads the web API base URL from `EXPO_PUBLIC_LIFEOS_API_BASE_URL` and starts with the Life Score / active goals surface.

The mobile app will ingest:

- Android Usage Stats API
- Android Health Connect
- iOS Screen Time API
- iOS HealthKit
- Firebase Cloud Messaging push tokens

The server-side batch contract is `POST /api/mobile/behavior-sync`. Native permission modules should convert platform data into the `MobileBehaviorSample` shape in `src/lifeosApi.ts`; the current Expo shell only emits demo samples when `EXPO_PUBLIC_LIFEOS_DEMO_SYNC=true`.
