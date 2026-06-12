"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { ThirteenFTable } from "@/components/ThirteenFTable";
import type { ThirteenFResult } from "@/lib/thirteenf/types";

type Manager = { cik: string; name: string; label: string };

function usd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function ThirteenFPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [activeCik, setActiveCik] = useState<string | null>(null);
  const [result, setResult] = useState<ThirteenFResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/13f")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setManagers(d.managers);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (cik: string) => {
    setActiveCik(cik);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/13f?cik=${encodeURIComponent(cik)}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "13F 조회 실패");
      setResult(data as ThirteenFResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "13F 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

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
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient-brand">13F 기관 보유내역</span>
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              유명 기관투자자의 분기 미국주식 보유와 직전 분기 대비 변화 (SEC EDGAR)
            </p>
          </div>
        </div>
      </header>

      {/* 기관 선택 */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          기관 선택
        </h2>
        <div className="flex flex-wrap gap-2">
          {managers.map((m) => (
            <button
              key={m.cik}
              onClick={() => load(m.cik)}
              disabled={loading}
              className={
                "rounded-lg px-3.5 py-2 text-xs font-medium transition disabled:opacity-50 " +
                (activeCik === m.cik
                  ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                  : "border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-emerald-500/40")
              }
            >
              {m.label}
            </button>
          ))}
          {managers.length === 0 && (
            <span className="text-sm text-[var(--color-muted)]">기관 목록 불러오는 중…</span>
          )}
        </div>
      </section>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-8 text-sm text-[var(--color-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          SEC EDGAR에서 13F 신고를 받아 직전 분기와 비교하는 중…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          오류: {error}
        </div>
      )}

      {result && !loading && (
        <section className="space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "기관", value: result.manager },
              { label: "보고 기준일", value: result.reportDate },
              { label: "포트폴리오", value: usd(result.totalValue) },
              { label: "보유 종목", value: `${result.positions}개` },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
                  {c.label}
                </div>
                <div className="mt-0.5 text-sm font-semibold">{c.value}</div>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">보유 종목 (평가액순)</h2>
            <span className="text-[11px] text-[var(--color-muted)]">
              변화는 직전 분기({result.prevReportDate ?? "—"}) 대비
            </span>
          </div>

          <ThirteenFTable rows={result.holdings} />

          {/* 전량 청산 */}
          {result.exited.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
              <h3 className="mb-2 text-xs font-semibold text-amber-300">
                직전 분기 대비 전량 청산 ({result.exited.length})
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-muted-foreground)]">
                {result.exited.map((e) => (
                  <span key={e.cusip}>
                    {e.issuer} <span className="font-mono text-[var(--color-muted)]">({usd(e.prevValue)})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-[var(--color-muted)]">
            출처 — {result.source} · 신고일 {result.filedAt} · 생성{" "}
            {new Date(result.generatedAt).toLocaleString("ko-KR")}
            {" · "}13F는 미국 롱 포지션만 공시하며 분기말 기준 ~45일 지연됩니다(투자 자문 아님).
          </p>
        </section>
      )}
    </main>
  );
}
