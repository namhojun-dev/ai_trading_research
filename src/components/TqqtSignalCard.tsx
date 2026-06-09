"use client";

import { motion } from "framer-motion";
import { Zap, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TqqtSignal } from "@/lib/types";

interface Props {
  signal: TqqtSignal;
  ticker: string;
}

const ACTION_STYLE = {
  매수: {
    label: "오늘 진입 (매수)",
    icon: TrendingUp,
    bg: "from-emerald-500/20 to-cyan-500/10 border-emerald-500/40",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    glow: "shadow-emerald-500/10",
  },
  공매도: {
    label: "오늘 공매도 (SQQQ)",
    icon: TrendingDown,
    bg: "from-red-500/20 to-orange-500/10 border-red-500/40",
    badge: "bg-red-500/20 text-red-300 border-red-500/40",
    glow: "shadow-red-500/10",
  },
  관망: {
    label: "오늘 패스 (관망)",
    icon: Minus,
    bg: "from-amber-500/15 to-yellow-500/5 border-amber-500/30",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    glow: "shadow-amber-500/10",
  },
};

const REGIME_LABEL = {
  추세장: { text: "추세장", color: "text-emerald-400" },
  횡보장: { text: "횡보장", color: "text-amber-400" },
  고변동: { text: "고변동", color: "text-red-400" },
};

const DECAY_LABEL = {
  낮음: { text: "감쇠 위험 낮음", color: "text-emerald-400", dot: "bg-emerald-400" },
  보통: { text: "감쇠 위험 보통", color: "text-amber-400", dot: "bg-amber-400" },
  높음: { text: "감쇠 위험 높음", color: "text-red-400", dot: "bg-red-400" },
};

export function TqqtSignalCard({ signal, ticker }: Props) {
  const style = ACTION_STYLE[signal.action];
  const ActionIcon = style.icon;
  const regime = REGIME_LABEL[signal.regime];
  const decay = DECAY_LABEL[signal.decay_risk];
  const scoreColor =
    signal.entry_score >= 80
      ? "text-emerald-300"
      : signal.entry_score >= 50
        ? "text-amber-300"
        : "text-red-300";

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-xl",
        style.bg,
        style.glow,
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/30">
            <Zap className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              TQQQ 단타 시그널
            </div>
            <div className="text-sm font-bold">{ticker} · 레버리지 3x</div>
          </div>
        </div>

        {/* Action badge */}
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2 text-base font-bold",
            style.badge,
          )}
        >
          <ActionIcon className="h-5 w-5" />
          {style.label}
        </div>
      </div>

      {/* Entry score bar */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-[var(--color-muted)]">진입 확신도 (Entry Score)</span>
          <span className={cn("font-mono text-lg font-bold tabular-nums", scoreColor)}>
            {signal.entry_score}
            <span className="ml-0.5 text-xs font-normal text-[var(--color-muted)]">/100</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/40">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${signal.entry_score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              signal.entry_score >= 80
                ? "bg-emerald-500"
                : signal.entry_score >= 50
                  ? "bg-amber-500"
                  : "bg-red-500",
            )}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)]">
          <span>패스 (&lt;50)</span>
          <span>조건부 (50-79)</span>
          <span>강한 진입 (80+)</span>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip label="레짐" value={regime.text} valueColor={regime.color} />
        <Chip label="감쇠" value={decay.text} valueColor={decay.color} />
      </div>

      {/* Time windows */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <TimeWindow icon={<Clock className="h-3.5 w-3.5 text-emerald-400" />} label="진입 시간" value={signal.entry_window} />
        <TimeWindow icon={<Clock className="h-3.5 w-3.5 text-amber-400" />} label="청산 시간" value={signal.exit_window} />
      </div>

      {/* Key conditions */}
      {signal.key_conditions.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/5 bg-black/25 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            <CheckCircle className="h-3 w-3" />
            진입 조건
          </div>
          <ul className="space-y-1">
            {signal.key_conditions.map((cond, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-muted)]" />
                {cond}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decay warning */}
      {signal.decay_risk === "높음" && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          변동성 감쇠(Beta Slippage) 위험이 높습니다. 횡보장에서 3x ETF는 방향성 없이도 손실이 누적됩니다.
        </div>
      )}
    </motion.div>
  );
}

function Chip({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5 text-xs">
      <span className="text-[var(--color-muted)]">{label}:</span>
      <span className={cn("font-semibold", valueColor)}>{value}</span>
    </div>
  );
}

function TimeWindow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/25 px-3 py-2">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{label}</div>
        <div className="text-xs font-medium">{value}</div>
      </div>
    </div>
  );
}
