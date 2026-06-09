"use client";

import { TrendingUp, TrendingDown, BarChart2, Activity, Award, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BacktestStats as Stats, BacktestTrade } from "@/lib/types";

interface Props {
  stats: Stats;
}

export function BacktestStats({ stats }: Props) {
  const hasData = stats.traded > 0;

  return (
    <div className="space-y-6">
      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="총 분석"
          value={stats.total_analyses}
          unit="회"
          icon={<BarChart2 className="h-4 w-4" />}
          color="text-[var(--color-muted-foreground)]"
        />
        <StatCard
          label="실제 거래"
          value={stats.traded}
          unit="회"
          icon={<Activity className="h-4 w-4" />}
          color="text-cyan-400"
        />
        <StatCard
          label="승률"
          value={hasData ? stats.win_rate.toFixed(1) : "—"}
          unit={hasData ? "%" : ""}
          icon={<Award className="h-4 w-4" />}
          color={stats.win_rate >= 55 ? "text-emerald-400" : stats.win_rate >= 45 ? "text-amber-400" : "text-red-400"}
        />
        <StatCard
          label="평균 수익률"
          value={hasData ? (stats.avg_return_pct >= 0 ? "+" : "") + stats.avg_return_pct.toFixed(2) : "—"}
          unit={hasData ? "%" : ""}
          icon={<TrendingUp className="h-4 w-4" />}
          color={stats.avg_return_pct >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <StatCard
          label="최대 낙폭"
          value={hasData ? `-${stats.max_drawdown_pct.toFixed(1)}` : "—"}
          unit={hasData ? "%" : ""}
          icon={<TrendingDown className="h-4 w-4" />}
          color="text-red-400"
        />
        <StatCard
          label="누적 수익"
          value={hasData ? (stats.cumulative_return_pct >= 0 ? "+" : "") + stats.cumulative_return_pct.toFixed(1) : "—"}
          unit={hasData ? "%" : ""}
          icon={<AlertTriangle className="h-4 w-4" />}
          color={stats.cumulative_return_pct >= 0 ? "text-emerald-400" : "text-red-400"}
        />
      </div>

      {/* Win/loss detail */}
      {hasData && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">적중 거래</div>
            <div className="mt-1 font-mono text-2xl font-bold text-emerald-300">{stats.wins}회</div>
            <div className="text-sm text-[var(--color-muted)]">
              평균 +{stats.avg_win_pct.toFixed(2)}%
            </div>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-red-400">손실 거래</div>
            <div className="mt-1 font-mono text-2xl font-bold text-red-300">{stats.losses}회</div>
            <div className="text-sm text-[var(--color-muted)]">
              평균 {stats.avg_loss_pct.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Trade log */}
      {stats.trades.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            거래 내역 ({stats.trades.length}건)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-3 py-2 text-left">날짜</th>
                  <th className="px-3 py-2 text-left">시그널</th>
                  <th className="px-3 py-2 text-right">진입점수</th>
                  <th className="px-3 py-2 text-right">다음날 수익</th>
                  <th className="px-3 py-2 text-right">결과</th>
                </tr>
              </thead>
              <tbody>
                {stats.trades.map((t) => (
                  <TradeRow key={t.record_id} trade={t} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-muted)]">
          분석 이력이 없습니다. TQQQ 또는 QQQ 분석을 먼저 실행하세요.
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: BacktestTrade }) {
  const isSkip = trade.signal === "관망";
  const ret = trade.return_pct;
  const correct = trade.is_correct;

  return (
    <tr className="border-b border-[var(--color-border-subtle)] last:border-0 hover:bg-[var(--color-surface-elevated)]">
      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-foreground)]">{trade.date}</td>
      <td className="px-3 py-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-semibold",
            trade.signal === "롱"
              ? "bg-emerald-500/15 text-emerald-300"
              : trade.signal === "숏"
                ? "bg-red-500/15 text-red-300"
                : "bg-[var(--color-border)] text-[var(--color-muted)]",
          )}
        >
          {trade.tqqt_action ?? trade.signal}
        </span>
      </td>
      <td className="px-3 py-2 text-right font-mono text-xs">
        {trade.entry_score !== null ? trade.entry_score : "—"}
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right font-mono text-xs tabular-nums",
          isSkip
            ? "text-[var(--color-muted)]"
            : ret !== null && ret >= 0
              ? "text-emerald-400"
              : "text-red-400",
        )}
      >
        {isSkip ? "—" : ret !== null ? `${ret >= 0 ? "+" : ""}${ret.toFixed(2)}%` : "—"}
      </td>
      <td className="px-3 py-2 text-right text-xs">
        {isSkip ? (
          <span className="text-[var(--color-muted)]">스킵</span>
        ) : correct === true ? (
          <span className="text-emerald-400">✓ 적중</span>
        ) : correct === false ? (
          <span className="text-red-400">✗ 손실</span>
        ) : (
          <span className="text-[var(--color-muted)]">데이터 없음</span>
        )}
      </td>
    </tr>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, unit, icon, color }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className={cn("mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider", color)}>
        {icon}
        {label}
      </div>
      <div className={cn("font-mono text-xl font-bold tabular-nums", color)}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal opacity-70">{unit}</span>}
      </div>
    </div>
  );
}
