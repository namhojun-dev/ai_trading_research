import { randomUUID } from "node:crypto";
import type {
  AnalysisRecord,
  ModelId,
  ModelOpinion,
  QuoteSnapshot,
  StreamEvent,
} from "@/lib/types";
import { isLeveragedTicker } from "@/lib/types";
import { callModel } from "@/lib/models";
import { callPerplexitySynthesis } from "@/lib/models/perplexity";
import {
  buildPerplexityPrompt,
  buildRound1Prompt,
  buildRound2Prompt,
  buildRound3Prompt,
  COMMON_INSTRUCTIONS_TQQT,
  PERPLEXITY_SYNTHESIS_SYSTEM_TQQT,
} from "@/lib/models/prompts";
import { saveAnalysis } from "@/lib/data/history";
import { fetchQuote } from "@/lib/data/quote";

const MODEL_IDS: ModelId[] = ["gpt", "gemini", "claude"];

type EmitFn = (evt: StreamEvent) => void;

interface RunOptions {
  ticker: string;
  emit: EmitFn;
}

export async function runAnalysis({ ticker, emit }: RunOptions): Promise<AnalysisRecord> {
  const startedAt = new Date().toISOString();
  const recordId = randomUUID();
  const opinions: ModelOpinion[] = [];
  const isTqqt = isLeveragedTicker(ticker);
  const systemPrompt = isTqqt ? COMMON_INSTRUCTIONS_TQQT : undefined;

  const quote: QuoteSnapshot | null = await fetchQuote(ticker);
  emit({ type: "start", ticker, quote });

  // ===== Round 1 =====
  emit({ type: "round-begin", round: 1 });
  const r1Prompt = buildRound1Prompt({ ticker, quote, isTqqt });
  const r1Results = await runRoundParallel(MODEL_IDS, r1Prompt, 1, emit, systemPrompt);
  opinions.push(...r1Results);

  // ===== Round 2 =====
  emit({ type: "round-begin", round: 2 });
  const r2Tasks = MODEL_IDS.map((selfModel) => {
    const ownR1 = r1Results.find((o) => o.modelId === selfModel)!;
    const othersR1 = r1Results.filter((o) => o.modelId !== selfModel);
    const prompt = buildRound2Prompt({ ticker, quote, selfModel, ownRound1: ownR1, othersRound1: othersR1, isTqqt });
    return { modelId: selfModel, prompt };
  });
  const r2Results = await Promise.all(
    r2Tasks.map(async ({ modelId, prompt }) => {
      try {
        const payload = await callModel(modelId, prompt, systemPrompt);
        const opinion: ModelOpinion = { ...payload, modelId, round: 2 };
        emit({ type: "opinion", opinion });
        return opinion;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "model-error", modelId, round: 2, message });
        return errorOpinion(modelId, 2, message);
      }
    }),
  );
  opinions.push(...r2Results);

  // ===== Round 3 =====
  emit({ type: "round-begin", round: 3 });
  const r3Tasks = MODEL_IDS.map((selfModel) => {
    const ownR1 = r1Results.find((o) => o.modelId === selfModel)!;
    const ownR2 = r2Results.find((o) => o.modelId === selfModel)!;
    const othersR2 = r2Results.filter((o) => o.modelId !== selfModel);
    const prompt = buildRound3Prompt({ ticker, selfModel, ownRound1: ownR1, ownRound2: ownR2, othersRound2: othersR2, isTqqt });
    return { modelId: selfModel, prompt };
  });
  const r3Results = await Promise.all(
    r3Tasks.map(async ({ modelId, prompt }) => {
      try {
        const payload = await callModel(modelId, prompt, systemPrompt);
        const opinion: ModelOpinion = { ...payload, modelId, round: 3 };
        emit({ type: "opinion", opinion });
        return opinion;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "model-error", modelId, round: 3, message });
        return errorOpinion(modelId, 3, message);
      }
    }),
  );
  opinions.push(...r3Results);

  // ===== Perplexity 종합 =====
  emit({ type: "synthesis-begin" });
  let synthesis = null as AnalysisRecord["synthesis"];
  try {
    const synthPrompt = buildPerplexityPrompt({ ticker, quote, finalOpinions: r3Results, isTqqt });
    const perplexitySystem = isTqqt ? PERPLEXITY_SYNTHESIS_SYSTEM_TQQT : undefined;
    synthesis = await callPerplexitySynthesis(synthPrompt, (text) => {
      emit({ type: "synthesis-delta", text });
    }, perplexitySystem);
    emit({ type: "synthesis", payload: synthesis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emit({ type: "error", message: `Perplexity 종합 실패: ${message}` });
  }

  const finishedAt = new Date().toISOString();
  const record: AnalysisRecord = { id: recordId, ticker, startedAt, finishedAt, quote, opinions, synthesis };

  try {
    await saveAnalysis(record);
  } catch (err) {
    console.error("[saveAnalysis] failed:", err);
  }

  emit({ type: "done", recordId });
  return record;
}

async function runRoundParallel(
  modelIds: ModelId[],
  prompt: string,
  round: 1 | 2 | 3,
  emit: EmitFn,
  systemPrompt?: string,
): Promise<ModelOpinion[]> {
  return Promise.all(
    modelIds.map(async (modelId) => {
      try {
        const payload = await callModel(modelId, prompt, systemPrompt);
        const opinion: ModelOpinion = { ...payload, modelId, round };
        emit({ type: "opinion", opinion });
        return opinion;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "model-error", modelId, round, message });
        return errorOpinion(modelId, round, message);
      }
    }),
  );
}

function errorOpinion(modelId: ModelId, round: 1 | 2 | 3, errorMessage: string): ModelOpinion {
  return {
    modelId,
    round,
    position: "관망",
    confidence: 0,
    strength: 0,
    target_price: null,
    stop_loss: null,
    key_reasons: [`오류 발생: ${errorMessage}`],
    body: `이 라운드에서 ${modelId} 호출에 실패했습니다.\n\n에러: ${errorMessage}`,
  };
}
