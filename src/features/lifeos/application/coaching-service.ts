import type { Assistant, CoachingResponse, Goal, GoalProbability, HabitInterference, LifeScoreResult } from "../domain/entities";
import { generateAICoaching } from "./openai-coaching";

export class CoachingService {
  async coach(
    assistant: Assistant,
    goals: Goal[],
    score: LifeScoreResult,
    probabilities: GoalProbability[],
    interferences: HabitInterference[],
  ): Promise<CoachingResponse> {
    const fallback = this.fallbackCoach(assistant, goals, score, probabilities, interferences);
    return (await generateAICoaching({ assistant, goals, score, probabilities, interferences })) ?? fallback;
  }

  private fallbackCoach(
    assistant: Assistant,
    goals: Goal[],
    score: LifeScoreResult,
    probabilities: GoalProbability[],
    interferences: HabitInterference[],
  ): CoachingResponse {
    const weakestGoal = [...probabilities].sort((a, b) => a.probability - b.probability)[0];
    const goal = goals.find((item) => item.id === weakestGoal?.goalId) ?? goals[0];
    const blocker = interferences[0];

    return {
      problem: `${goal?.title ?? "핵심 목표"} 달성 확률이 ${weakestGoal?.probability ?? score.today}% 수준에 머물러 있습니다.`,
      insight: blocker
        ? `${blocker.behavior}이 가장 큰 병목입니다. ${blocker.evidence}가 반복되면 Life Score가 빠르게 떨어집니다.`
        : `${assistant.name}가 보기에 오늘의 실행력은 유지되고 있으나 회복 루틴을 더 안정화해야 합니다.`,
      today_action: blocker
        ? `${blocker.replacement}을 오늘 일정에 고정하세요. 완료하면 캐릭터 경험치 180을 지급합니다.`
        : "가장 중요한 목표에 40분 집중 블록을 하나 더 배치하세요.",
      motivation: "오늘은 인생 전체를 바꾸는 날이 아니라, 내일의 확률을 3% 올리는 날입니다.",
    };
  }
}
