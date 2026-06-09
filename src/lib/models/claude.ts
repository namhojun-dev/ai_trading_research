import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { parseOpinion } from "./parse";
import { COMMON_INSTRUCTIONS } from "./prompts";
import type { OpinionPayload } from "@/lib/types";

export async function callClaude(prompt: string, systemPrompt?: string): Promise<OpinionPayload> {
  const { text } = await generateText({
    // Claude Opus 4.8 — Anthropic 최신 최고 성능 모델.
    model: anthropic("claude-opus-4-8"),
    system: systemPrompt ?? COMMON_INSTRUCTIONS,
    prompt,
    tools: {
      web_search: anthropic.tools.webSearch_20250305({
        maxUses: 5,
      }),
    },
    maxRetries: 1,
  });
  return parseOpinion(text);
}
