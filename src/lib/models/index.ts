import type { ModelId, OpinionPayload } from "@/lib/types";
import { callGPT } from "./gpt";
import { callGemini } from "./gemini";

const TIMEOUT_MS = 120_000; // 모델별 2분 상한

export async function callModel(
  id: ModelId,
  prompt: string,
  systemPrompt?: string,
): Promise<OpinionPayload> {
  const fn = id === "gpt" ? callGPT : callGemini;
  return await Promise.race([
    fn(prompt, systemPrompt),
    new Promise<OpinionPayload>((_, reject) =>
      setTimeout(() => reject(new Error(`${id} 호출 시간 초과 (${TIMEOUT_MS / 1000}s)`)), TIMEOUT_MS),
    ),
  ]);
}
