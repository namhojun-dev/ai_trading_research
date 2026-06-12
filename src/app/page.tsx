"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { TickerSearch } from "@/components/TickerSearch";
import { PriceHeader } from "@/components/PriceHeader";
import { GaugePanel } from "@/components/GaugePanel";
import { DiscussionGrid } from "@/components/DiscussionGrid";
import { SynthesisPanel } from "@/components/SynthesisPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { ModelIcon } from "@/components/ModelIcon";
import {
  ComparableValuationPanel,
  type ComparableResult,
} from "@/components/ComparableValuationPanel";
import {
  MODELS,
  PERPLEXITY_META,
  type ModelOpinion,
  type QuoteSnapshot,
  type StreamEvent,
  type SynthesisPayload,
} from "@/lib/types";

interface AnalysisState {
  ticker: string;
  quote: QuoteSnapshot | null;
  opinions: ModelOpinion[];
  currentRound: 1 | 2 | 3 | null;
  synthesis: SynthesisPayload | null;
  synthesisLoading: boolean;
  synthesisPartial: string;
  done: boolean;
  error: string | null;
}

const initialState: AnalysisState = {
  ticker: "",
  quote: null,
  opinions: [],
  currentRound: null,
  synthesis: null,
  synthesisLoading: false,
  synthesisPartial: "",
  done: false,
  error: null,
};

// 한국 종목(6자리 코드 / 한글명 / .KS·.KQ)이면 유사 종목 비교(국내 전용)를,
// 그 외(미국 티커)면 멀티 LLM 분석을 수행한다.
function isKoreanTicker(t: string): boolean {
  const s = t.trim();
  return /^\d{6}$/.test(s) || /[가-힣]/.test(s) || /\.(ks|kq)$/i.test(s);
}

export default function HomePage() {
  const [state, setState] = useState<AnalysisState>(initialState);
  const [running, setRunning] = useState(false);
  const [krMode, setKrMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 유사 종목 비교 (독립 기능 — /api/analyze SSE와 분리)
  const [comparables, setComparables] = useState<ComparableResult | null>(null);
  const [comparablesLoading, setComparablesLoading] = useState(false);
  const [comparablesError, setComparablesError] = useState<string | null>(null);

  const loadComparables = useCallback(async (ticker: string) => {
    setComparables(null);
    setComparablesError(null);
    setComparablesLoading(true);
    try {
      const res = await fetch(`/api/comparables?ticker=${encodeURIComponent(ticker)}`);
      const data = (await res.json()) as ComparableResult;
      setComparables(data);
    } catch (err) {
      setComparablesError(err instanceof Error ? err.message : "비교 분석 실패");
    } finally {
      setComparablesLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (ticker: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const korean = isKoreanTicker(ticker);
    setKrMode(korean);
    setState({ ...initialState, ticker });

    if (korean) {
      // 한국 종목: 미국 전용 LLM 분석은 건너뛰고 유사 종목 비교만 수행
      setRunning(false);
      void loadComparables(ticker);
      return;
    }

    // 미국 종목: 멀티 LLM 분석 수행 (비교 기능은 국내 전용이라 비활성화)
    setComparables(null);
    setComparablesError(null);
    setComparablesLoading(false);
    setRunning(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setState((s) => ({ ...s, error: data.error ?? "요청 실패" }));
        setRunning(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as StreamEvent;
            applyEvent(evt);
          } catch {
            // ignore malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    } finally {
      setRunning(false);
    }
  }, [loadComparables]);

  function applyEvent(evt: StreamEvent) {
    setState((s) => {
      switch (evt.type) {
        case "start":
          return { ...s, ticker: evt.ticker, quote: evt.quote };
        case "round-begin":
          return { ...s, currentRound: evt.round };
        case "opinion":
          return {
            ...s,
            opinions: [
              ...s.opinions.filter(
                (o) => !(o.modelId === evt.opinion.modelId && o.round === evt.opinion.round),
              ),
              evt.opinion,
            ],
          };
        case "model-error":
          return {
            ...s,
            opinions: [
              ...s.opinions.filter((o) => !(o.modelId === evt.modelId && o.round === evt.round)),
              {
                modelId: evt.modelId,
                round: evt.round,
                position: "관망",
                confidence: 0,
                strength: 0,
                target_price: null,
                stop_loss: null,
                key_reasons: [`오류: ${evt.message}`],
                body: `이 라운드 호출 실패\n\n${evt.message}`,
              },
            ],
          };
        case "synthesis-begin":
          return { ...s, synthesisLoading: true, currentRound: null };
        case "synthesis-delta":
          return { ...s, synthesisPartial: s.synthesisPartial + evt.text };
        case "synthesis":
          return { ...s, synthesis: evt.payload, synthesisLoading: false };
        case "done":
          return { ...s, done: true, synthesisLoading: false };
        case "error":
          return { ...s, error: evt.message, synthesisLoading: false };
        default:
          return s;
      }
    });
  }

  const hasResult = state.opinions.length > 0 || state.synthesis !== null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
            <ModelIcon model={PERPLEXITY_META} size={22} className="opacity-90" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient-brand">AI Compete</span>
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              미국 티커 멀티 LLM 분석 · 한국 종목 유사 종목 비교
            </p>
          </div>
        </div>
        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href="/13f"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted-foreground)] transition hover:border-emerald-500/40 hover:text-emerald-300"
          >
            13F 기관 보유 →
          </Link>
          <Link
            href="/screener"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted-foreground)] transition hover:border-emerald-500/40 hover:text-emerald-300"
          >
            섹터 스크리너 →
          </Link>
        </nav>
      </header>

      {/* Search */}
      <section className="mb-10 flex flex-col items-center gap-4">
        <TickerSearch onSubmit={handleSubmit} disabled={running} />
        {!hasResult && !running && !comparables && !comparablesLoading && (
          <p className="text-center text-sm text-[var(--color-muted)]">
            <span className="text-foreground/80">미국 티커</span>(예: AAPL) → GPT·Gemini·Claude {MODELS.length}개 모델 토론 분석
            <br />
            <span className="text-foreground/80">한국 종목</span>(예: 005930 · 삼성전자) → 유사 종목 PER·EPS 저평가 비교
          </p>
        )}
      </section>

      {/* Error (미국 분석 모드에서만) */}
      {!krMode && state.error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          오류: {state.error}
        </div>
      )}

      {/* Result */}
      {(state.ticker || hasResult || running || comparables || comparablesLoading) && (
        <div className="space-y-8">
          {/* === 미국 멀티 LLM 분석 (한국 모드에서는 숨김) === */}
          {!krMode && (
          <>
          {/* Price */}
          <PriceHeader ticker={state.ticker} quote={state.quote} />

          {/* Round indicator */}
          {running && state.currentRound && (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
              <Activity className="h-4 w-4 animate-pulse" />
              <span className="font-medium">
                {state.currentRound}차 라운드 진행 중 · {MODELS.length}개 모델 병렬 분석
              </span>
            </div>
          )}
          {running && state.synthesisLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-cyan-400">
              <Activity className="h-4 w-4 animate-pulse" />
              <span className="font-medium">Perplexity 실시간 종합 진행 중</span>
            </div>
          )}

          {/* Discussion */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              3 라운드 토론
            </h2>
            <DiscussionGrid opinions={state.opinions} currentRound={state.currentRound} />
          </section>

          {/* Gauges */}
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                모델별 최종 포지션 게이지
              </h2>
              <p className="text-[11px] text-[var(--color-muted)]">
                바늘 = <span className="text-foreground/80">포지션 방향과 강도</span> (왼쪽 숏 ↔ 오른쪽 롱)
                {" · "}
                강도 바 = <span className="text-foreground/80">−100 ~ +100</span>
                {" · "}
                신뢰도 바 = <span className="text-foreground/80">0 ~ 100%</span>
              </p>
            </div>
            <GaugePanel opinions={state.opinions} loading={running} />
          </section>

          {/* Synthesis */}
          {(state.synthesis || state.synthesisLoading) && (
            <section>
              <SynthesisPanel
                synthesis={state.synthesis}
                loading={state.synthesisLoading}
                partialText={state.synthesisPartial}
              />
            </section>
          )}
          </>
          )}

          {/* === 유사 종목 밸류에이션 비교 (한국 종목 전용) === */}
          {(comparablesLoading || comparablesError || comparables) && (
            <ComparableValuationPanel
              loading={comparablesLoading}
              error={comparablesError}
              data={comparables}
            />
          )}
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
