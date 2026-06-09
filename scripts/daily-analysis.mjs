#!/usr/bin/env node
/**
 * 매일 자동 실행 스크립트 — TQQQ 단타 시그널 분석 후 Telegram 알림
 *
 * 사용법:
 *   node scripts/daily-analysis.mjs [TICKER]
 *
 * crontab 등록 예시 (WSL Ubuntu, 매일 오후 10시 30분 KST = 13:30 UTC):
 *   30 13 * * 1-5 /usr/bin/node /home/lunan/workspace/ai_trading_research/scripts/daily-analysis.mjs 2>&1 | logger -t ai-compete
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load .env.local
const envPath = resolve(ROOT, ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// Load schedule config
const scheduleConfigPath = resolve(ROOT, "data", "schedule.json");
let scheduleConfig = {};
if (existsSync(scheduleConfigPath)) {
  try {
    scheduleConfig = JSON.parse(readFileSync(scheduleConfigPath, "utf-8"));
  } catch {}
}

const ticker = process.argv[2] || scheduleConfig.ticker || "TQQQ";
const telegramToken = scheduleConfig.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || "";
const telegramChatId = scheduleConfig.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || "";

console.log(`[ai-compete] Starting daily analysis for ${ticker} at ${new Date().toISOString()}`);

// ─── Telegram helper ───────────────────────────────────────────────────────
async function sendTelegram(message) {
  if (!telegramToken || !telegramChatId) {
    console.log("[ai-compete] Telegram not configured, skipping notification");
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) {
      console.error("[ai-compete] Telegram error:", await res.text());
    } else {
      console.log("[ai-compete] Telegram notification sent");
    }
  } catch (err) {
    console.error("[ai-compete] Telegram send failed:", err.message);
  }
}

// ─── Main analysis ────────────────────────────────────────────────────────
async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  await sendTelegram(`⏳ <b>${ticker} 단타 분석 시작</b>\n시각: ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`);

  let record;
  try {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error ?? "분석 API 오류");
    }

    // Parse SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const block of events) {
        const line = block.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "done") console.log(`[ai-compete] Analysis done: ${evt.recordId}`);
          if (evt.type === "synthesis") record = evt.payload;
        } catch {}
      }
    }
  } catch (err) {
    console.error("[ai-compete] Analysis failed:", err.message);
    await sendTelegram(`❌ <b>${ticker} 분석 실패</b>\n${err.message}`);

    // Update last_run status
    await updateLastRun("error");
    process.exit(1);
  }

  // Build Telegram message
  const signal = record?.tqqt_signal;
  const consensus = record?.consensus ?? "관망";

  let msg = `📊 <b>${ticker} AI 단타 시그널</b>\n`;
  msg += `🕐 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n\n`;

  if (signal) {
    const actionEmoji = signal.action === "매수" ? "🟢" : signal.action === "공매도" ? "🔴" : "🟡";
    msg += `${actionEmoji} <b>오늘 액션: ${signal.action}</b>\n`;
    msg += `📈 진입 확신도: ${signal.entry_score}/100\n`;
    msg += `🌊 레짐: ${signal.regime}\n`;
    msg += `⚠️ 감쇠 위험: ${signal.decay_risk}\n\n`;
    msg += `⏰ 진입: ${signal.entry_window}\n`;
    msg += `🏁 청산: ${signal.exit_window}\n\n`;
    if (signal.key_conditions?.length > 0) {
      msg += `📌 조건:\n${signal.key_conditions.map((c) => `  • ${c}`).join("\n")}\n\n`;
    }
  } else {
    const emoji = consensus === "롱" ? "🟢" : consensus === "숏" ? "🔴" : "🟡";
    msg += `${emoji} AI 합의: <b>${consensus}</b>\n\n`;
  }

  if (record?.summary) {
    msg += `💬 ${record.summary.slice(0, 300)}${record.summary.length > 300 ? "..." : ""}\n\n`;
  }

  if (record?.target_price) msg += `🎯 목표가: $${record.target_price}\n`;
  if (record?.stop_loss) msg += `🛡 손절가: $${record.stop_loss}\n`;
  if (record?.warning) msg += `\n⚠️ ${record.warning}`;

  await sendTelegram(msg);
  await updateLastRun("success");

  console.log(`[ai-compete] Done. Signal: ${signal?.action ?? consensus}`);
}

async function updateLastRun(status) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/schedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ last_run_at: new Date().toISOString(), last_run_status: status }),
      },
    );
    if (!res.ok) console.error("[ai-compete] Failed to update last_run");
  } catch {}
}

main().catch((err) => {
  console.error("[ai-compete] Fatal error:", err);
  process.exit(1);
});
