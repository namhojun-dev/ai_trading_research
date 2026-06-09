"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { BacktestTrade } from "@/lib/types";

interface Props {
  trades: BacktestTrade[];
}

export function BacktestEquityCurve({ trades }: Props) {
  const tradable = trades.filter((t) => t.signal !== "관망" && t.return_pct !== null);
  if (tradable.length === 0) return null;

  // Build cumulative equity curve (start at 100)
  let equity = 100;
  const data = [{ date: "시작", equity: 100 }];
  for (const t of tradable) {
    equity *= 1 + (t.return_pct ?? 0) / 100;
    data.push({
      date: t.date.slice(5), // MM-DD
      equity: Math.round(equity * 100) / 100,
    });
  }

  const final = data[data.length - 1].equity;
  const isPositive = final >= 100;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          누적 수익 곡선 (가상 $100 투자)
        </h3>
        <span
          className={
            isPositive ? "font-mono text-sm font-bold text-emerald-400" : "font-mono text-sm font-bold text-red-400"
          }
        >
          ${final.toFixed(2)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            contentStyle={{
              background: "#111114",
              border: "1px solid #2a2a32",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "누적"]}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <ReferenceLine y={100} stroke="#2a2a32" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="equity"
            stroke={isPositive ? "#10b981" : "#ef4444"}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
