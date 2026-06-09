import type { BehaviorLog, BehaviorType, Goal, GoalProbability, LifeScoreResult } from "../domain/entities";

function clamp(value: number, min = 5, max = 95) {
  return Math.max(min, Math.min(max, value));
}

function valueFor(logs: BehaviorLog[], type: BehaviorType) {
  return logs.filter((log) => log.type === type).reduce((sum, log) => sum + log.value, 0);
}

function daysUntil(deadline: string) {
  return Math.max(1, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}

function categoryFor(goal: Goal) {
  const text = `${goal.title} ${goal.description}`.toLowerCase();
  if (/(체중|감량|다이어트|마라톤|운동|weight|run|fitness)/.test(text)) return "fitness";
  if (/(영어|회화|english|language)/.test(text)) return "language";
  if (/(공부|학습|시험|study|saas|ai)/.test(text)) return "study";
  if (/(투자|trading|investment|finance)/.test(text)) return "investment";
  return "general";
}

export class GoalProbabilityEngine {
  calculate(goals: Goal[], logs: BehaviorLog[], score: LifeScoreResult): GoalProbability[] {
    return goals.map((goal) => {
      const category = categoryFor(goal);
      const priorityBoost = goal.priority === "high" ? 8 : goal.priority === "medium" ? 3 : -2;
      const timePressure = clamp(daysUntil(goal.deadline) / 1.4, 0, 18);
      const snsMinutes = valueFor(logs, "sns_minutes");
      const youtubeMinutes = valueFor(logs, "youtube_minutes");
      const sleepHours = valueFor(logs, "sleep_hours");

      let alignment = 0;
      const reasons: string[] = [];

      if (category === "fitness") {
        alignment += valueFor(logs, "exercise_minutes") * 0.34 + valueFor(logs, "steps") / 900;
        alignment -= valueFor(logs, "late_snack_count") * 9;
        reasons.push("운동량과 걸음수가 체중 목표에 직접 기여합니다.");
      } else if (category === "language") {
        alignment += valueFor(logs, "study_minutes") * 0.28 + valueFor(logs, "reading_minutes") * 0.24;
        alignment -= snsMinutes * 0.08;
        reasons.push("학습 시간이 유지되고 있지만 회화 반복량은 더 필요합니다.");
      } else if (category === "study") {
        alignment += valueFor(logs, "study_minutes") * 0.36 + valueFor(logs, "reading_minutes") * 0.18;
        alignment -= youtubeMinutes * 0.11;
        reasons.push("공부 시간은 확보됐지만 영상 사용 시간이 집중 확률을 낮춥니다.");
      } else {
        alignment += score.today * 0.18;
        reasons.push("전반적인 생활 점수가 목표 실행력을 지지합니다.");
      }

      if (sleepHours < 7) reasons.push("수면 부족이 내일 실행 에너지를 낮출 수 있습니다.");
      if (snsMinutes + youtubeMinutes > 150) reasons.push("주의 분산 시간이 목표 달성 확률을 끌어내립니다.");

      const probability = Math.round(clamp(score.today * 0.58 + alignment * 0.42 + priorityBoost + timePressure * 0.4));

      return {
        goalId: goal.id,
        probability,
        confidence: logs.length >= 7 ? "high" : "medium",
        trend: probability >= 76 ? "up" : probability < 48 ? "down" : "flat",
        reasons: reasons.slice(0, 3),
      };
    });
  }
}
