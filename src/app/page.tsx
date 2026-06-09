"use client";

import { useCallback, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { TickerSearch } from "@/components/TickerSearch";
import { PriceHeader } from "@/components/PriceHeader";
import { GaugePanel } from "@/components/GaugePanel";
import { DiscussionGrid } from "@/components/DiscussionGrid";
import { SynthesisPanel } from "@/components/SynthesisPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { ModelIcon } from "@/components/ModelIcon";
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

export default function HomePage() {
  const [state, setState] = useState<AnalysisState>(initialState);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (ticker: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRunning(true);
    setState({ ...initialState, ticker });

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
  }, []);

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
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
            <ModelIcon model={PERPLEXITY_META} size={22} className="opacity-90" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient-brand">AI Compete</span>
            </h1>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              GPT · Gemini 3 라운드 토론 + Perplexity 실시간 종합
            </p>
          </div>
        </div>
      </header>

      {/* Search */}
      <section className="mb-10 flex flex-col items-center gap-4">
        <TickerSearch onSubmit={handleSubmit} disabled={running} />
        {!hasResult && !running && (
          <p className="text-center text-sm text-[var(--color-muted)]">
            미국 주식 티커를 입력하면 GPT와 Gemini가 실시간 서치로 포지션을 분석합니다.
            <br />
            <span className="text-xs">
              참여 모델 <span className="font-mono font-semibold text-emerald-400">{MODELS.length}개</span>
              {" · "}예상 소요 30~75초
            </span>
          </p>
        )}
      </section>

      {/* Error */}
      {state.error && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          오류: {state.error}
        </div>
      )}

      {/* Result */}
      {(state.ticker || hasResult || running) && (
        <div className="space-y-8">
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
        </div>
      )}

      <Disclaimer />
    </main>
  );
}
