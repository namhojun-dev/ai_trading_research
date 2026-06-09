"use client";

import { useState, useEffect } from "react";
import { Clock, Bell, Copy, Check, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScheduleConfig } from "@/lib/types";

export function SchedulerPanel() {
  const [config, setConfig] = useState<Partial<ScheduleConfig>>({
    enabled: false,
    ticker: "TQQQ",
    hour_kr: 22,
    minute_kr: 30,
    telegram_bot_token: "",
    telegram_chat_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const crontabLine = buildCrontabPreview(config);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(crontabLine);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-muted)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        스케줄러 설정 로딩 중...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="h-5 w-5 text-cyan-400" />
          <div>
            <div className="text-sm font-semibold">자동 분석 스케줄러</div>
            <div className="text-xs text-[var(--color-muted)]">
              매일 정해진 시간에 분석 실행 + Telegram 알림
            </div>
          </div>
        </div>
        <span className="text-xs text-[var(--color-muted)]">{expanded ? "▲ 닫기" : "▼ 설정"}</span>
      </button>

      {!expanded && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-muted)]">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              config.enabled ? "bg-emerald-400" : "bg-[var(--color-border)]",
            )}
          />
          {config.enabled
            ? `${config.ticker} 매일 ${pad(config.hour_kr ?? 22)}:${pad(config.minute_kr ?? 30)} KST 실행`
            : "비활성화됨"}
        </div>
      )}

      {expanded && (
        <div className="mt-5 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">스케줄 활성화</span>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            >
              {config.enabled ? (
                <ToggleRight className="h-7 w-7 text-emerald-400" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-[var(--color-muted)]" />
              )}
            </button>
          </div>

          {/* Ticker + Time */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="종목">
              <input
                type="text"
                value={config.ticker ?? "TQQQ"}
                onChange={(e) => setConfig((c) => ({ ...c, ticker: e.target.value.toUpperCase() }))}
                className="input-field w-full"
                placeholder="TQQQ"
              />
            </Field>
            <Field label="시 (KST)">
              <input
                type="number"
                min={0}
                max={23}
                value={config.hour_kr ?? 22}
                onChange={(e) => setConfig((c) => ({ ...c, hour_kr: Number(e.target.value) }))}
                className="input-field w-full"
              />
            </Field>
            <Field label="분 (KST)">
              <input
                type="number"
                min={0}
                max={59}
                value={config.minute_kr ?? 30}
                onChange={(e) => setConfig((c) => ({ ...c, minute_kr: Number(e.target.value) }))}
                className="input-field w-full"
              />
            </Field>
          </div>

          {/* Telegram */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Bell className="h-3.5 w-3.5" />
              Telegram 알림 설정
            </div>
            <Field label="Bot Token">
              <input
                type="password"
                value={config.telegram_bot_token ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, telegram_bot_token: e.target.value }))}
                className="input-field w-full"
                placeholder="1234567890:AAF..."
              />
            </Field>
            <Field label="Chat ID">
              <input
                type="text"
                value={config.telegram_chat_id ?? ""}
                onChange={(e) => setConfig((c) => ({ ...c, telegram_chat_id: e.target.value }))}
                className="input-field w-full"
                placeholder="-100xxxxxxxxx"
              />
            </Field>
          </div>

          {/* Crontab preview */}
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-black/30 p-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              crontab 등록 명령어 (WSL Ubuntu)
            </div>
            <code className="block text-[11px] text-cyan-300 break-all">{crontabLine}</code>
            <div className="mt-2 text-[10px] text-[var(--color-muted)]">
              터미널에서 <code className="text-amber-300">crontab -e</code> 후 위 줄을 붙여넣기 하세요.
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="mt-2 flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-muted-foreground)] transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "저장 중..." : "설정 저장"}
          </button>

          {config.last_run_at && (
            <div className="text-[11px] text-[var(--color-muted)]">
              마지막 실행: {new Date(config.last_run_at).toLocaleString("ko-KR")}
              {config.last_run_status && (
                <span
                  className={cn(
                    "ml-2",
                    config.last_run_status === "success" ? "text-emerald-400" : "text-red-400",
                  )}
                >
                  {config.last_run_status === "success" ? "성공" : "실패"}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-[var(--color-muted)]">{label}</label>
      {children}
    </div>
  );
}

function pad(n: number | undefined) {
  return String(n ?? 0).padStart(2, "0");
}

function buildCrontabPreview(config: Partial<ScheduleConfig>): string {
  const h = config.hour_kr ?? 22;
  const m = config.minute_kr ?? 30;
  const totalMinutes = h * 60 + m - 9 * 60;
  const norm = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const utcH = Math.floor(norm / 60);
  const utcM = norm % 60;
  const script = "~/workspace/ai_trading_research/scripts/daily-analysis.mjs";
  return `${utcM} ${utcH} * * 1-5 /usr/bin/node ${script} 2>&1 | logger -t ai-compete`;
}
