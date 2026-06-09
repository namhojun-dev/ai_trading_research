import { createCipheriv, createDecipheriv, createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type {
  AiSettings,
  AlertRunRecord,
  AlertRule,
  ApiKeyStatus,
  LayoutSettings,
  PortfolioPosition,
  UserTerminalState,
} from "@/lib/types";

export const SESSION_COOKIE = "kfin_session";

interface StoredApiKey {
  encryptedValue: string;
  updatedAt: string;
}

interface StoredProfile {
  portfolio: PortfolioPosition[];
  watchlist: string[];
  apiKeys: Record<string, StoredApiKey>;
  aiSettings: AiSettings;
  layout: LayoutSettings;
  alerts: AlertRule[];
  alertRuns?: AlertRunRecord[];
}

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
  profile: StoredProfile;
}

interface UserStore {
  users: UserRecord[];
}

export interface UserStateUpdate {
  portfolio?: PortfolioPosition[];
  watchlist?: string[];
  apiKeys?: Record<string, string | null>;
  aiSettings?: Partial<AiSettings>;
  layout?: Partial<LayoutSettings>;
  alerts?: AlertRule[];
}

const STORE_PATH = path.join(process.cwd(), "data", "kfin-terminal", "users.json");
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function loginOrRegister(email: string, password: string): Promise<UserRecord> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizedEmail)) {
    throw new Error("유효한 이메일이 필요합니다.");
  }
  if (password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다.");
  }

  const store = await readStore();
  const existing = store.users.find((user) => user.email === normalizedEmail);
  if (existing) {
    if (!verifyPassword(password, existing.passwordSalt, existing.passwordHash)) {
      throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    return existing;
  }

  const now = new Date().toISOString();
  const passwordSalt = randomBytes(16).toString("base64url");
  const user: UserRecord = {
    id: randomBytes(16).toString("base64url"),
    email: normalizedEmail,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
    createdAt: now,
    updatedAt: now,
    profile: defaultProfile(now),
  };
  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function findUserBySession(sessionValue: string | undefined): Promise<UserRecord | null> {
  const userId = verifySession(sessionValue);
  if (!userId) return null;
  const store = await readStore();
  return store.users.find((user) => user.id === userId) ?? null;
}

export async function updateUserState(
  userId: string,
  update: UserStateUpdate,
): Promise<UserTerminalState> {
  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) throw new Error("사용자 세션을 찾을 수 없습니다.");

  const now = new Date().toISOString();
  if (update.portfolio) user.profile.portfolio = sanitizePortfolio(update.portfolio);
  if (update.watchlist) user.profile.watchlist = sanitizeWatchlist(update.watchlist);
  if (update.aiSettings) user.profile.aiSettings = { ...user.profile.aiSettings, ...sanitizeAiSettings(update.aiSettings) };
  if (update.layout) user.profile.layout = { ...user.profile.layout, ...sanitizeLayout(update.layout) };
  if (update.alerts) user.profile.alerts = sanitizeAlerts(update.alerts);
  if (update.apiKeys) {
    for (const [provider, value] of Object.entries(update.apiKeys)) {
      const normalizedProvider = provider.trim().toLowerCase();
      if (!normalizedProvider) continue;
      if (!value) {
        delete user.profile.apiKeys[normalizedProvider];
      } else {
        user.profile.apiKeys[normalizedProvider] = {
          encryptedValue: encryptSecret(value),
          updatedAt: now,
        };
      }
    }
  }

  user.updatedAt = now;
  await writeStore(store);
  return toPublicState(user);
}

export function toPublicState(user: UserRecord): UserTerminalState {
  return {
    email: user.email,
    portfolio: user.profile.portfolio,
    watchlist: user.profile.watchlist,
    apiKeys: Object.entries(user.profile.apiKeys).map(([provider, value]): ApiKeyStatus => ({
      provider,
      configured: true,
      updatedAt: value.updatedAt,
    })),
    aiSettings: user.profile.aiSettings,
    layout: user.profile.layout,
    alerts: user.profile.alerts,
    alertRuns: user.profile.alertRuns ?? [],
    updatedAt: user.updatedAt,
  };
}

export async function appendAlertRun(
  userId: string,
  run: AlertRunRecord,
): Promise<UserTerminalState> {
  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) throw new Error("사용자 세션을 찾을 수 없습니다.");
  user.profile.alertRuns = [run, ...(user.profile.alertRuns ?? [])].slice(0, 50);
  user.updatedAt = run.ranAt;
  await writeStore(store);
  return toPublicState(user);
}

export function getStoredApiKey(user: UserRecord | null, provider: string): string | null {
  const encryptedValue = user?.profile.apiKeys[provider.trim().toLowerCase()]?.encryptedValue;
  if (!encryptedValue) return null;
  try {
    return decryptSecret(encryptedValue);
  } catch {
    return null;
  }
}

export function getConfiguredApiProviders(user: UserRecord | null): Set<string> {
  return new Set(Object.keys(user?.profile.apiKeys ?? {}));
}

export function createSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function sessionMaxAge() {
  return SESSION_MAX_AGE_SECONDS;
}

function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtText, signature] = parts;
  const payload = `${userId}.${expiresAtText}`;
  const expected = sign(payload);
  if (!safeEqual(signature, expected)) return null;
  const expiresAt = Number(expiresAtText);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null;
  return userId || null;
}

async function readStore(): Promise<UserStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as UserStore;
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

async function writeStore(store: UserStore) {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function defaultProfile(now: string): StoredProfile {
  return {
    portfolio: [],
    watchlist: ["AAPL", "NVDA", "MSFT", "QQQ", "SPY"],
    apiKeys: {},
    aiSettings: {
      primaryModel: "gpt",
      language: "ko",
      riskProfile: "balanced",
    },
    layout: {
      density: "compact",
      leftRail: true,
      rightRail: true,
    },
    alerts: [],
    alertRuns: [],
  };
}

function hashPassword(password: string, salt: string) {
  return pbkdf2Sync(password, salt, 310000, 32, "sha256").toString("base64url");
}

function verifyPassword(password: string, salt: string, expectedHash: string) {
  return safeEqual(hashPassword(password, salt), expectedHash);
}

function sign(payload: string) {
  return createHmac("sha256", secretMaterial("KFIN_SESSION_SECRET")).update(payload).digest("base64url");
}

function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secretMaterial("KFIN_ENCRYPTION_KEY")).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptSecret(value: string) {
  const [version, ivText, tagText, encryptedText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !encryptedText) throw new Error("지원하지 않는 API 키 암호문입니다.");
  const key = createHash("sha256").update(secretMaterial("KFIN_ENCRYPTION_KEY")).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function secretMaterial(name: "KFIN_SESSION_SECRET" | "KFIN_ENCRYPTION_KEY") {
  return process.env[name] || process.env.KFIN_LOCAL_SECRET || "k-fin-terminal-local-dev-secret";
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function sanitizeWatchlist(value: string[]) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((symbol): symbol is string => typeof symbol === "string")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 50);
}

function sanitizePortfolio(value: PortfolioPosition[]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      symbol: typeof item.symbol === "string" ? item.symbol.trim().toUpperCase() : "",
      quantity: Number(item.quantity),
      averageCost: typeof item.averageCost === "number" && Number.isFinite(item.averageCost) ? item.averageCost : null,
      currency: typeof item.currency === "string" ? item.currency.trim().toUpperCase() || "USD" : "USD",
    }))
    .filter((item) => item.symbol && Number.isFinite(item.quantity))
    .slice(0, 200);
}

function sanitizeAiSettings(value: Partial<AiSettings>): Partial<AiSettings> {
  const next: Partial<AiSettings> = { language: "ko" };
  if (typeof value.primaryModel === "string" && value.primaryModel.trim()) {
    next.primaryModel = value.primaryModel.trim().slice(0, 40);
  }
  if (["conservative", "balanced", "aggressive"].includes(value.riskProfile ?? "")) {
    next.riskProfile = value.riskProfile;
  }
  return next;
}

function sanitizeLayout(value: Partial<LayoutSettings>): Partial<LayoutSettings> {
  const next: Partial<LayoutSettings> = {};
  if (value.density === "standard" || value.density === "compact") next.density = value.density;
  if (typeof value.leftRail === "boolean") next.leftRail = value.leftRail;
  if (typeof value.rightRail === "boolean") next.rightRail = value.rightRail;
  return next;
}

function sanitizeAlerts(value: AlertRule[]) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AlertRule => {
      const metric: AlertRule["metric"] = item.metric === "change_percent" ? "change_percent" : "price";
      const operator: AlertRule["operator"] = item.operator === "below" ? "below" : "above";
      return {
        id: typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 80) : randomBytes(8).toString("base64url"),
        symbol: typeof item.symbol === "string" ? item.symbol.trim().toUpperCase() : "",
        metric,
        operator,
        value: Number(item.value),
        enabled: Boolean(item.enabled),
      };
    })
    .filter((item) => item.symbol && Number.isFinite(item.value))
    .slice(0, 100);
}

export const decryptStoredSecretForProvider = decryptSecret;
