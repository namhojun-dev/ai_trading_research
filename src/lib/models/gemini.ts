import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { parseOpinion } from "./parse";
import { COMMON_INSTRUCTIONS } from "./prompts";
import type { OpinionPayload } from "@/lib/types";

export async function callGemini(prompt: string, systemPrompt?: string): Promise<OpinionPayload> {
  const { text } = await generateText({
    model: google("gemini-2.5-pro"),
    system: systemPrompt ?? COMMON_INSTRUCTIONS,
    prompt,
    tools: {
      google_search: google.tools.googleSearch({}),
    },
    maxRetries: 1,
  });
  return parseOpinion(text);
}
