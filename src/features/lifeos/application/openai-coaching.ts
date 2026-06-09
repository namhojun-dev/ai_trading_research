import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";
import type { Assistant, CoachingResponse, Goal, GoalProbability, HabitInterference, LifeScoreResult } from "../domain/entities";

const CoachingSchema = z.object({
  problem: z.string().min(1),
  insight: z.string().min(1),
  today_action: z.string().min(1),
  motivation: z.string().min(1),
});

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenced?.[1] ?? trimmed;
  return JSON.parse(source);
}

export async function generateAICoaching(input: {
  assistant: Assistant;
  goals: Goal[];
  score: LifeScoreResult;
  probabilities: GoalProbability[];
  interferences: HabitInterference[];
}): Promise<CoachingResponse | null> {
  if (!process.env.OPENAI_API_KEY || process.env.LIFEOS_ENABLE_OPENAI_COACHING !== "true") {
    return null;
  }

  try {
    const { text } = await generateText({
      model: openai.responses(process.env.OPENAI_LIFEOS_MODEL ?? "gpt-5-mini"),
      system:
        "당신은 사용자의 목표 달성을 돕는 AI 라이프 코치이다. 반드시 JSON만 반환한다. 스키마는 { problem, insight, today_action, motivation } 이다.",
      prompt: JSON.stringify({
        assistant: input.assistant,
        goals: input.goals,
        lifeScore: input.score,
        probabilities: input.probabilities,
        habitInterferences: input.interferences,
        outputLanguage: "ko",
      }),
      maxRetries: 1,
    });

    return CoachingSchema.parse(extractJson(text));
  } catch {
    return null;
  }
}
