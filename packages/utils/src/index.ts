export function clampLifeOSScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toISODate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function maskSensitiveToken(token: string) {
  if (token.length <= 16) return "********";
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected LifeOS value: ${String(value)}`);
}
