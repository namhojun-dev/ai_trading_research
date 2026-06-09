type LogLevel = "info" | "warn" | "error";

interface LifeOSLogEvent {
  level: LogLevel;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
  at: string;
}

export function logLifeOSEvent(level: LogLevel, scope: string, message: string, meta?: Record<string, unknown>) {
  const event: LifeOSLogEvent = {
    level,
    scope,
    message,
    meta,
    at: new Date().toISOString(),
  };

  if (level === "error") {
    console.error(JSON.stringify(event));
  } else if (level === "warn") {
    console.warn(JSON.stringify(event));
  } else {
    console.info(JSON.stringify(event));
  }
}
