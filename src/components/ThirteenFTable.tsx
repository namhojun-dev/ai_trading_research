"use client";

import type { Holding } from "@/lib/thirteenf/types";

function usd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function shares(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString("en-US");
}

const CHANGE_BADGE: Record<Holding["change"], { label: string; cls: string }> = {
  new: { label: "신규", cls: "bg-emerald-500/15 text-emerald-300" },
  add: { label: "추가", cls: "bg-cyan-500/15 text-cyan-300" },
  reduce: { label: "축소", cls: "bg-amber-500/15 text-amber-300" },
  unchanged: { label: "유지", cls: "text-[var(--color-muted)]" },
};

export function ThirteenFTable({ rows }: { rows: Holding[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
        보유 종목이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full min-w-[820px] border-collapse text-right text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]">
            <th className="px-2 py-2 text-center">순위</th>
            <th className="px-2 py-2 text-left">티커</th>
            <th className="px-2 py-2 text-left">종목 (발행사)</th>
            <th className="px-2 py-2">평가액</th>
            <th className="px-2 py-2">비중</th>
            <th className="px-2 py-2">보유주식</th>
            <th className="px-2 py-2 text-center">변화</th>
            <th className="px-2 py-2">QoQ 주식</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const badge = CHANGE_BADGE[h.change];
            return (
              <tr
                key={`${h.cusip}-${h.titleOfClass}-${h.putCall ?? ""}`}
                className="border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-surface)]/40"
              >
                <td className="px-2 py-2 text-center font-mono font-semibold text-emerald-400">
                  {h.rank}
                </td>
                <td className="px-2 py-2 text-left font-mono font-semibold">
                  {h.ticker ? (
                    <span className="text-cyan-300">{h.ticker}</span>
                  ) : (
                    <span className="text-[var(--color-muted)]" title={`CUSIP ${h.cusip}`}>
                      —
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-left font-medium">
                  {h.issuer}
                  {h.putCall && (
                    <span className="ml-1.5 rounded bg-[var(--color-surface)] px-1 text-[10px] text-[var(--color-muted)]">
                      {h.putCall}
                    </span>
                  )}
                  <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted)]">{h.cusip}</span>
                </td>
                <td className="px-2 py-2 font-mono">{usd(h.value)}</td>
                <td className="px-2 py-2 font-mono">{h.pct.toFixed(1)}%</td>
                <td className="px-2 py-2 font-mono">{shares(h.shares)}</td>
                <td className="px-2 py-2 text-center">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-2 py-2 font-mono">
                  {h.deltaSharesPct == null ? (
                    <span className="text-emerald-400">NEW</span>
                  ) : (
                    <span
                      className={
                        h.deltaSharesPct > 0.5
                          ? "text-cyan-300"
                          : h.deltaSharesPct < -0.5
                            ? "text-amber-300"
                            : "text-[var(--color-muted)]"
                      }
                    >
                      {h.deltaSharesPct > 0 ? "+" : ""}
                      {h.deltaSharesPct.toFixed(0)}%
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
