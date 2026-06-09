import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { parseOpinion } from "./parse";
import { COMMON_INSTRUCTIONS } from "./prompts";
import type { OpinionPayload } from "@/lib/types";

export async function callGPT(prompt: string, systemPrompt?: string): Promise<OpinionPayload> {
  const { text } = await generateText({
    model: openai.responses("gpt-5.4"),
    system: systemPrompt ?? COMMON_INSTRUCTIONS,
    prompt,
    tools: {
      web_search_preview: openai.tools.webSearchPreview({
        searchContextSize: "medium",
      }),
    },
    maxRetries: 1,
  });
  return parseOpinion(text);
}
