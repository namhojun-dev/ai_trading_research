import type { Intervention, PushToken, UserProfile } from "@/features/lifeos/domain/entities";

export interface PushDeliveryResult {
  delivered: boolean;
  provider: "fcm";
  reason?: string;
  attemptedTokens: number;
  failedTokens: number;
}

export async function sendInterventionPush(
  user: UserProfile,
  intervention: Intervention,
  tokens: PushToken[] = [],
): Promise<PushDeliveryResult> {
  if (!intervention.shouldSend) {
    return { delivered: false, provider: "fcm", reason: "intervention_not_required", attemptedTokens: 0, failedTokens: 0 };
  }

  if (tokens.length === 0) {
    return { delivered: false, provider: "fcm", reason: "device_token_not_registered", attemptedTokens: 0, failedTokens: 0 };
  }

  if (!process.env.FIREBASE_SERVER_KEY) {
    return { delivered: false, provider: "fcm", reason: "firebase_not_configured", attemptedTokens: tokens.length, failedTokens: tokens.length };
  }

  const responses = await Promise.allSettled(
    tokens.map(async (item) => {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          Authorization: `key=${process.env.FIREBASE_SERVER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: item.token,
          notification: {
            title: intervention.title,
            body: intervention.message,
          },
          data: {
            type: "lifeos_intervention",
            userId: user.id,
            trigger: intervention.trigger,
            probabilityDelta: String(intervention.probabilityDelta),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`FCM request failed with ${response.status}`);
      }
    }),
  );

  const failedTokens = responses.filter((result) => result.status === "rejected").length;
  return {
    delivered: failedTokens < tokens.length,
    provider: "fcm",
    reason: failedTokens < tokens.length ? undefined : "fcm_delivery_failed",
    attemptedTokens: tokens.length,
    failedTokens,
  };
}
