"use client";

import type { ComparableCompany } from "@/lib/comparables/types";

function krw(n: number | null | undefined): string {
  return n == null ? "—" : Math.round(n).toLocaleString("ko-KR");
}
function dec(n: number | null | undefined, d = 1): string {
  return n == null ? "—" : n.toFixed(d);
}
function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${n.toFixed(1)}%`;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-cyan-300";
  if (score >= 35) return "text-amber-300";
  return "text-[var(--color-muted)]";
}

interface Props {
  rows: ComparableCompany[];
  market: "KOSPI" | "KOSDAQ";
}

export function ComparableRankingTable({ rows, market }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
        {market} 유사 종목 후보를 찾지 못했습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full min-w-[980px] border-collapse text-right text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]">
            <th className="px-2 py-2 text-center">순위</th>
            <th className="px-2 py-2 text-left">종목명</th>
            <th className="px-2 py-2 text-left">티커</th>
            <th className="px-2 py-2 text-center">시장</th>
            <th className="px-2 py-2 text-left">업종</th>
            <th className="px-2 py-2">현재가</th>
            <th className="px-2 py-2">PER</th>
            <th className="px-2 py-2">EPS</th>
            <th className="px-2 py-2">PBR</th>
            <th className="px-2 py-2">ROE</th>
            <th className="px-2 py-2">매출성장</th>
            <th className="px-2 py-2">영업이익률</th>
            <th className="px-2 py-2">유사도</th>
            <th className="px-2 py-2">저평가</th>
            <th className="px-2 py-2">최종</th>
            <th className="px-2 py-2 text-left">의견</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr
              key={c.ticker}
              className="border-b border-[var(--color-border)]/50 last:border-0 hover:bg-[var(--color-surface)]/40"
            >
              <td className="px-2 py-2 text-center font-mono font-semibold text-emerald-400">
                {c.rank ?? "-"}
              </td>
              <td className="px-2 py-2 text-left font-medium">{c.name}</td>
              <td className="px-2 py-2 text-left font-mono text-[var(--color-muted-foreground)]">
                {c.ticker}
              </td>
              <td className="px-2 py-2 text-center text-[var(--color-muted)]">{c.market}</td>
              <td className="px-2 py-2 text-left text-[var(--color-muted-foreground)]">
                {c.industry ?? c.sector ?? "—"}
              </td>
              <td className="px-2 py-2 font-mono">{krw(c.price)}</td>
              <td className="px-2 py-2 font-mono">{dec(c.per)}</td>
              <td className="px-2 py-2 font-mono">{krw(c.eps)}</td>
              <td className="px-2 py-2 font-mono">{dec(c.pbr, 2)}</td>
              <td className="px-2 py-2 font-mono">{pct(c.roe)}</td>
              <td className="px-2 py-2 font-mono">{pct(c.revenueGrowthYoY)}</td>
              <td className="px-2 py-2 font-mono">{pct(c.operatingMargin)}</td>
              <td className="px-2 py-2 font-mono">{c.similarityScore}</td>
              <td className="px-2 py-2 font-mono">
                {c.dataStatus.financials === "missing" ? (
                  <span className="text-[var(--color-muted)]" title="데이터 없음">
                    계산불가
                  </span>
                ) : (
                  c.valuationScore
                )}
              </td>
              <td className={`px-2 py-2 font-mono font-bold ${scoreColor(c.finalScore)}`}>
                {c.finalScore}
              </td>
              <td className="px-2 py-2 text-left text-[11px] text-[var(--color-muted-foreground)]">
                {c.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
