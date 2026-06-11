"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Filter, Loader2 } from "lucide-react";
import { ScreenerTable } from "@/components/ScreenerTable";
import type { ComparableCompany } from "@/lib/comparables/types";

type IndustryInfo = { industry: string; label: string; count: number };
type SectorInfo = { sector: string; label: string; count: number; industries: IndustryInfo[] };

type ScreenerResult = {
  ok: true;
  kind: "sector" | "industry";
  key: string;
  label: string;
  count: number;
  rows: ComparableCompany[];
  generatedAt: string;
  dataSource: { price: string; financials: string };
  warnings: string[];
};

export default function ScreenerPage() {
  const [sectors, setSectors] = useState<SectorInfo[]>([]);
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [activeIndustry, setActiveIndustry] = useState<string | null>(null);
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [market, setMarket] = useState<"ALL" | "KOSPI" | "KOSDAQ">("ALL");
  const [sort, setSort] = useState<"value" | "per" | "roe" | "pbr">("value");

  useEffect(() => {
    fetch("/api/screener")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setSectors(d.sectors);
      })
      .catch(() => {});
  }, []);

  const run = useCallback(async (qs: string) => {
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/screener?${qs}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "스크리닝 실패");
      setResult(data as ScreenerResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "스크리닝 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSector = useCallback(
    (sector: string) => {
      setActiveSector(sector);
      setActiveIndustry(null);
      void run(`sector=${encodeURIComponent(sector)}`);
    },
    [run],
  );

  const loadIndustry = useCallback(
    (industry: string) => {
      setActiveIndustry(industry);
      void run(`industry=${encodeURIComponent(industry)}`);
    },
    [run],
  );

  const activeSectorInfo = sectors.find((s) => s.sector === activeSector);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 분석 대시보드로
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
            <Filter className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient-brand">섹터 저평가 스크리너</span>
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              섹터를 고르면 그 안의 종목을 실적 대비 저평가 점수순으로 정렬 (DART 실데이터)
            </p>
          </div>
        </div>
      </header>

      {/* 섹터 선택 */}
      <section className="mb-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          섹터 선택
        </h2>
        <div className="flex flex-wrap gap-2">
          {sectors.map((s) => (
            <button
              key={s.sector}
              onClick={() => loadSector(s.sector)}
              disabled={loading}
              className={
                "rounded-lg px-3.5 py-2 text-xs font-medium transition disabled:opacity-50 " +
                (activeSector === s.sector
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-emerald-500/40")
              }
            >
              {s.label}
              <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted)]">{s.count}</span>
            </button>
          ))}
          {sectors.length === 0 && (
            <span className="text-sm text-[var(--color-muted)]">섹터 목록 불러오는 중…</span>
          )}
        </div>
      </section>

      {/* 업종 세분화 (선택한 섹터의 하위 업종) */}
      {activeSectorInfo && activeSectorInfo.industries.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            업종 세분화 <span className="text-[var(--color-muted-foreground)]">— {activeSectorInfo.label}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadSector(activeSectorInfo.sector)}
              disabled={loading}
              className={
                "rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-50 " +
                (!activeIndustry
                  ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
              }
            >
              전체 섹터
            </button>
            {activeSectorInfo.industries.map((ind) => (
              <button
                key={ind.industry}
                onClick={() => loadIndustry(ind.industry)}
                disabled={loading}
                className={
                  "rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-50 " +
                  (activeIndustry === ind.industry
                    ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                    : "border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] hover:border-cyan-500/40")
                }
              >
                {ind.label}
                <span className="ml-1.5 font-mono text-[10px] text-[var(--color-muted)]">{ind.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 결과 */}
      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-8 text-sm text-[var(--color-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          섹터 종목 재무를 조회하고 저평가 점수를 계산하는 중…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          오류: {error}
        </div>
      )}

      {result && !loading && (() => {
        const kospiN = result.rows.filter((c) => c.market === "KOSPI").length;
        const kosdaqN = result.rows.filter((c) => c.market === "KOSDAQ").length;
        // 정렬 비교자 — null/적자는 항상 하위로
        const ascNull = (v: number | null | undefined) => (v == null || v <= 0 ? Infinity : v);
        const descNull = (v: number | null | undefined) => (v == null ? -Infinity : v);
        const sortFns = {
          value: (a: typeof result.rows[number], b: typeof result.rows[number]) =>
            b.valuationScore - a.valuationScore || b.qualityScore - a.qualityScore,
          per: (a: typeof result.rows[number], b: typeof result.rows[number]) =>
            ascNull(a.per) - ascNull(b.per),
          roe: (a: typeof result.rows[number], b: typeof result.rows[number]) =>
            descNull(b.roe) - descNull(a.roe),
          pbr: (a: typeof result.rows[number], b: typeof result.rows[number]) =>
            ascNull(a.pbr) - ascNull(b.pbr),
        } as const;
        // 시장 필터 → 정렬 → 순위 재계산 (1..N)
        const rows = result.rows
          .filter((c) => market === "ALL" || c.market === market)
          .slice()
          .sort(sortFns[sort])
          .map((c, i) => ({ ...c, rank: i + 1 }));
        const tabs: { key: "ALL" | "KOSPI" | "KOSDAQ"; label: string; n: number }[] = [
          { key: "ALL", label: "전체", n: result.count },
          { key: "KOSPI", label: "코스피", n: kospiN },
          { key: "KOSDAQ", label: "코스닥", n: kosdaqN },
        ];
        const sortTabs: { key: typeof sort; label: string }[] = [
          { key: "value", label: "저평가점수" },
          { key: "per", label: "PER↓" },
          { key: "roe", label: "ROE↑" },
          { key: "pbr", label: "PBR↓" },
        ];
        return (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">
              {result.label}{" "}
              <span className="font-mono text-xs text-[var(--color-muted)]">{rows.length}종목</span>
            </h2>
            <div className="flex items-center gap-3">
              {/* 시장 필터 */}
              <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setMarket(t.key)}
                    disabled={t.n === 0}
                    className={
                      "rounded-md px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-30 " +
                      (market === t.key
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
                    }
                  >
                    {t.label}
                    <span className="ml-1 font-mono text-[10px] text-[var(--color-muted)]">{t.n}</span>
                  </button>
                ))}
              </div>
              {/* 정렬 옵션 */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--color-muted)]">정렬</span>
                <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-0.5">
                  {sortTabs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setSort(t.key)}
                      className={
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition " +
                        (sort === t.key
                          ? "bg-cyan-500/15 text-cyan-300"
                          : "text-[var(--color-muted)] hover:text-[var(--color-foreground)]")
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <ScreenerTable rows={rows} />

          {result.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <ul className="list-disc space-y-1 pl-5 text-[11px] text-amber-200/80">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-[var(--color-muted)]">
            데이터 출처 — 가격: {result.dataSource.price} · 재무: {result.dataSource.financials}
            {" · "}생성 {new Date(result.generatedAt).toLocaleString("ko-KR")}
            {" · "}저평가 점수 = PER·EPS·ROE·영업이익률·매출성장·PBR 정량 점수(투자 자문 아님).
          </p>
        </section>
        );
      })()}
    </main>
  );
}
