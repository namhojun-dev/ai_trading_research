import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "enc:v1:";

function keyFromSecret(secret: string) {
  return scryptSync(secret, "lifeos-ai", 32);
}

export function encryptSensitiveValue(value: string, secret = process.env.LIFEOS_ENCRYPTION_KEY) {
  if (!secret) {
    throw new Error("LIFEOS_ENCRYPTION_KEY is required for encryption");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSensitiveValue(payload: string, secret = process.env.LIFEOS_ENCRYPTION_KEY) {
  if (!secret) {
    throw new Error("LIFEOS_ENCRYPTION_KEY is required for decryption");
  }

  const encryptedPayload = payload.startsWith(ENCRYPTED_PREFIX) ? payload.slice(ENCRYPTED_PREFIX.length) : payload;
  const [iv, tag, encrypted] = encryptedPayload.split(".");
  if (!iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = createDecipheriv(ALGORITHM, keyFromSecret(secret), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

export function isEncryptedSensitiveValue(value: string) {
  return value.startsWith(ENCRYPTED_PREFIX);
}

export function maybeEncryptSensitiveValue(value: string, secret = process.env.LIFEOS_ENCRYPTION_KEY) {
  return secret ? encryptSensitiveValue(value, secret) : value;
}

export function maybeDecryptSensitiveValue(value: string, secret = process.env.LIFEOS_ENCRYPTION_KEY) {
  if (!isEncryptedSensitiveValue(value)) return value;
  return decryptSensitiveValue(value, secret);
}

export function fingerprintSensitiveValue(value: string, secret = process.env.LIFEOS_ENCRYPTION_KEY) {
  if (secret) {
    return createHmac("sha256", keyFromSecret(secret)).update(value).digest("hex");
  }

  return createHash("sha256").update(value).digest("hex");
}
