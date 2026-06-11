"use client";

import { useState } from "react";
import { BarChart3, Loader2, Info } from "lucide-react";
import { ComparableRankingTable } from "./ComparableRankingTable";
import { ValuationScoreCard } from "./ValuationScoreCard";
import { ComparableSummary } from "./ComparableSummary";
import type { ComparableApiResponse } from "@/lib/comparables/types";

export type ComparableResult =
  | ComparableApiResponse
  | { ok: false; error: string; reason?: string };

interface Props {
  loading: boolean;
  error: string | null;
  data: ComparableResult | null;
}

export function ComparableValuationPanel({ loading, error, data }: Props) {
  const [tab, setTab] = useState<"KOSPI" | "KOSDAQ">("KOSPI");

  const header = (
    <div className="flex items-center gap-2">
      <BarChart3 className="h-4 w-4 text-emerald-400" />
      <h2 className="text-sm font-semibold">유사 종목 밸류에이션 비교</h2>
    </div>
  );

  if (loading) {
    return (
      <section className="space-y-3">
        {header}
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-8 text-sm text-[var(--color-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          유사 종목을 찾고 PER·EPS를 비교하는 중…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        {header}
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          비교 분석 오류: {error}
        </div>
      </section>
    );
  }

  if (!data) return null;

  if (!data.ok) {
    const isEtf = "reason" in data && data.reason === "etf";
    return (
      <section className="space-y-3">
        {header}
        <div className="flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 text-sm text-cyan-200/90">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{isEtf ? data.error : `비교 불가: ${data.error}`}</span>
        </div>
      </section>
    );
  }

  const peers = [...data.kospi, ...data.kosdaq];
  const rows = tab === "KOSPI" ? data.kospi : data.kosdaq;

  return (
    <section className="space-y-4">
      {header}

      {/* 기준 종목 요약 */}
      <ValuationScoreCard base={data.baseCompany} peers={peers} />

      {/* 시장 탭 */}
      <div className="flex gap-2">
        {(["KOSPI", "KOSDAQ"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            className={
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition " +
              (tab === m
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
            }
          >
            {m} 저평가 순위
            <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted)]">
              {(m === "KOSPI" ? data.kospi : data.kosdaq).length}
            </span>
          </button>
        ))}
      </div>

      <ComparableRankingTable rows={rows} market={tab} />

      {/* 해석 + 출처/주의 */}
      <ComparableSummary
        summary={data.summary}
        dataSource={data.dataSource}
        warnings={data.warnings}
        generatedAt={data.generatedAt}
      />
    </section>
  );
}
