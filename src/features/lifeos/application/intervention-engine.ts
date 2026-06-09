import type { BehaviorLog, BehaviorType, Goal, GoalProbability, Intervention } from "../domain/entities";

function valueFor(logs: BehaviorLog[], type: BehaviorType) {
  return logs.filter((log) => log.type === type).reduce((sum, log) => sum + log.value, 0);
}

export class InterventionEngine {
  evaluate(goals: Goal[], logs: BehaviorLog[], probabilities: GoalProbability[]): Intervention {
    const youtubeMinutes = valueFor(logs, "youtube_minutes");
    const snsMinutes = valueFor(logs, "sns_minutes");
    const lowest = [...probabilities].sort((a, b) => a.probability - b.probability)[0];
    const goal = goals.find((item) => item.id === lowest?.goalId);

    if (youtubeMinutes >= 80 || snsMinutes >= 100) {
      return {
        shouldSend: true,
        title: "목표 달성 확률 하락 중",
        message: `${goal?.title ?? "핵심 목표"} 확률이 방해 행동 때문에 감소하고 있습니다. 지금 25분 집중 블록으로 전환하세요.`,
        probabilityDelta: -7,
        trigger: youtubeMinutes >= 80 ? "youtube_over_80m" : "sns_over_100m",
      };
    }

    return {
      shouldSend: false,
      title: "개입 불필요",
      message: "현재 행동 패턴은 목표 확률을 유지하고 있습니다.",
      probabilityDelta: 0,
      trigger: "stable",
    };
  }
}
