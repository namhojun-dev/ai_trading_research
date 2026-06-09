import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { LifeOSSnapshot } from "@/features/lifeos/domain/entities";
import { logLifeOSEvent } from "@/lib/logging/lifeos-logger";

const CoachingSchema = z.object({
  problem: z.string(),
  insight: z.string(),
  today_action: z.string(),
  motivation: z.string(),
});

export const LIFEOS_COACH_SYSTEM_PROMPT = `
You are an AI life coach that helps the user reach goals.

Input:
- goals
- behavior data
- LifeScore

Return only JSON in this shape:
{
  "problem": "specific problem",
  "insight": "root cause",
  "today_action": "one concrete action for today",
  "motivation": "short motivation"
}
`;

export async function generateAICoaching(snapshot: LifeOSSnapshot) {
  if (!process.env.OPENAI_API_KEY) {
    return snapshot.coach;
  }

  try {
    const result = await generateObject({
      model: openai(process.env.OPENAI_LIFEOS_MODEL ?? "gpt-5-mini"),
      schema: CoachingSchema,
      system: LIFEOS_COACH_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        goals: snapshot.goals,
        behaviorLogs: snapshot.behaviorLogs,
        lifeScore: snapshot.lifeScore,
        probabilities: snapshot.probabilities,
        interferences: snapshot.interferences,
      }),
      abortSignal: AbortSignal.timeout(8_000),
    });

    return result.object;
  } catch (error) {
    logLifeOSEvent("warn", "lifeos.coach", "OpenAI coaching failed; falling back to rule-based coaching", {
      error: error instanceof Error ? error.message : String(error),
    });
    return snapshot.coach;
  }
}
