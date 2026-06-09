import { parseSynthesis } from "./parse";
import { PERPLEXITY_SYNTHESIS_SYSTEM } from "./prompts";
import type { SynthesisPayload } from "@/lib/types";

interface PerplexityResponse {
  choices: { message: { content: string } }[];
  citations?: string[];
}

export async function callPerplexitySynthesis(
  prompt: string,
  onDelta?: (text: string) => void,
  systemPrompt?: string,
): Promise<SynthesisPayload> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY가 설정되지 않았습니다.");
  }

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-reasoning-pro",
      messages: [
        { role: "system", content: systemPrompt ?? PERPLEXITY_SYNTHESIS_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Perplexity API 오류 (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as PerplexityResponse;
  const content = data.choices?.[0]?.message?.content ?? "";

  // Optional: emit content as a single chunk for UX consistency
  if (onDelta && content) onDelta(content);

  const parsed = parseSynthesis(content);

  // Merge top-level citations array (Perplexity returns array of URLs)
  if (data.citations && data.citations.length > 0 && parsed.citations.length === 0) {
    parsed.citations = data.citations.slice(0, 12).map((url) => ({
      title: new URL(url).hostname,
      url,
    }));
  }

  return parsed;
}
