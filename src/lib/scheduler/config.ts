import { promises as fs } from "node:fs";
import path from "node:path";
import type { ScheduleConfig } from "@/lib/types";

const CONFIG_PATH = path.join(process.cwd(), "data", "schedule.json");

const DEFAULT_CONFIG: ScheduleConfig = {
  enabled: false,
  ticker: "TQQQ",
  hour_kr: 22,
  minute_kr: 30,
  telegram_bot_token: "",
  telegram_chat_id: "",
  last_run_at: null,
  last_run_status: null,
};

export async function loadScheduleConfig(): Promise<ScheduleConfig> {
  try {
    const content = await fs.readFile(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveScheduleConfig(config: ScheduleConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

// Returns the crontab line for the given config (UTC-based)
export function buildCrontabLine(config: ScheduleConfig, scriptPath: string): string {
  // KST = UTC+9 → convert to UTC
  const totalMinutes = config.hour_kr * 60 + config.minute_kr - 9 * 60;
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const utcHour = Math.floor(normalizedMinutes / 60);
  const utcMin = normalizedMinutes % 60;
  return `${utcMin} ${utcHour} * * 1-5 /usr/bin/node ${scriptPath} 2>&1 | logger -t ai-compete`;
}
