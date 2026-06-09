import { createHmac, timingSafeEqual } from "node:crypto";

export interface LifeOSJwtPayload {
  sub: string;
  email: string;
  name?: string;
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function getSecret() {
  return process.env.LIFEOS_JWT_SECRET || process.env.LIFEOS_ENCRYPTION_KEY || "lifeos-local-development-secret";
}

function sign(data: string) {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createLifeOSJwt(payload: Omit<LifeOSJwtPayload, "iat" | "exp">, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + maxAgeSeconds }));
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyLifeOSJwt(token?: string | null): LifeOSJwtPayload | null {
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;

  const expected = sign(`${header}.${body}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LifeOSJwtPayload;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}
