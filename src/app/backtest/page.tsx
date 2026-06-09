"use client";

import { useState, useCallback } from "react";
import { BarChart2, Loader2, RefreshCw } from "lucide-react";
import { BacktestStats } from "@/components/BacktestStats";
import { BacktestEquityCurve } from "@/components/BacktestEquityCurve";
import type { BacktestStats as StatsType } from "@/lib/types";

const PRESET_TICKERS = ["TQQQ", "QQQ", "SQQQ", "QLD"];

export default function BacktestPage() {
  const [ticker, setTicker] = useState("TQQQ");
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    setStats(null);
    try {
      const res = await fetch(`/api/backtest?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "백테스트 실패");
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">백테스트</h1>
            <p className="text-xs text-[var(--color-muted)]">
              AI 시그널 vs 실제 다음날 수익률 검증
            </p>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--color-muted)]">티커</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="input-field w-28"
              placeholder="TQQQ"
            />
            <button
              type="button"
              onClick={() => runBacktest(ticker)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "분석 중..." : "백테스트 실행"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_TICKERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTicker(t); runBacktest(t); }}
              disabled={loading}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted-foreground)] transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
        <strong>방법론:</strong> AI 합의 시그널(롱/숏/관망)을 기준으로, 다음 거래일 시가→종가 수익률과 비교합니다.
        관망 시그널은 거래 없음으로 처리. 과거 이력이 없으면 먼저 분석을 실행하세요.
        <br />
        <strong>주의:</strong> 이 백테스트는 미래 수익을 보장하지 않으며 투자 자문이 아닙니다.
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          오류: {error}
        </div>
      )}

      {/* Results */}
      {stats && (
        <div className="space-y-6">
          <BacktestEquityCurve trades={stats.trades} />
          <BacktestStats stats={stats} />
        </div>
      )}

      {!stats && !loading && !error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center text-sm text-[var(--color-muted)]">
          티커를 선택하거나 입력 후 백테스트 실행을 누르세요.
        </div>
      )}

      <p className="mt-8 text-center text-[11px] text-[var(--color-muted)]">
        수익률은 실제 체결가 기준이 아니며 슬리피지·수수료·세금을 반영하지 않습니다.
      </p>
    </main>
  );
}
