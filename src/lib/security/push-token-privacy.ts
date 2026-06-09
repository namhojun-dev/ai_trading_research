import type { CreatePushTokenInput, PushToken } from "@/features/lifeos/domain/entities";
import {
  fingerprintSensitiveValue,
  isEncryptedSensitiveValue,
  maybeDecryptSensitiveValue,
  maybeEncryptSensitiveValue,
} from "./crypto";

export function securePushTokenForStorage(input: CreatePushTokenInput): CreatePushTokenInput {
  return {
    ...input,
    token: maybeEncryptSensitiveValue(input.token),
    tokenHash: fingerprintSensitiveValue(input.token),
    encrypted: Boolean(process.env.LIFEOS_ENCRYPTION_KEY),
  };
}

export function revealPushToken(token: PushToken): PushToken {
  return {
    ...token,
    token: maybeDecryptSensitiveValue(token.token),
    encrypted: isEncryptedSensitiveValue(token.token),
  };
}
