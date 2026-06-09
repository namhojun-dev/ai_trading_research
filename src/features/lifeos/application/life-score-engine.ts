import type { BehaviorLog, BehaviorType, LifeScoreComponent, LifeScoreResult } from "../domain/entities";

const LABELS: Record<LifeScoreComponent["key"], string> = {
  exercise: "운동",
  sleep: "수면",
  focus: "집중",
  distraction: "방해 행동",
  recovery: "회복",
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function valueFor(logs: BehaviorLog[], type: BehaviorType) {
  return logs.filter((log) => log.type === type).reduce((sum, log) => sum + log.value, 0);
}

function component(key: LifeScoreComponent["key"], score: number, impact: string): LifeScoreComponent {
  return {
    key,
    label: LABELS[key],
    score: Math.round(clamp(score)),
    impact,
  };
}

export class LifeScoreEngine {
  calculate(logs: BehaviorLog[]): LifeScoreResult {
    const exerciseMinutes = valueFor(logs, "exercise_minutes");
    const steps = valueFor(logs, "steps");
    const sleepHours = valueFor(logs, "sleep_hours");
    const studyMinutes = valueFor(logs, "study_minutes");
    const readingMinutes = valueFor(logs, "reading_minutes");
    const snsMinutes = valueFor(logs, "sns_minutes");
    const gameMinutes = valueFor(logs, "game_minutes");
    const youtubeMinutes = valueFor(logs, "youtube_minutes");
    const lateSnacks = valueFor(logs, "late_snack_count");

    const exerciseScore = clamp(exerciseMinutes * 1.45 + steps / 180);
    const sleepScore = clamp(100 - Math.abs(7.5 - sleepHours) * 18);
    const focusScore = clamp(studyMinutes * 0.68 + readingMinutes * 0.9);
    const distractionScore = clamp(100 - snsMinutes * 0.36 - gameMinutes * 0.48 - youtubeMinutes * 0.28);
    const recoveryScore = clamp(sleepScore * 0.58 + distractionScore * 0.24 + (lateSnacks === 0 ? 18 : 4));

    const today = Math.round(
      exerciseScore * 0.24 +
        sleepScore * 0.24 +
        focusScore * 0.22 +
        distractionScore * 0.18 +
        recoveryScore * 0.12,
    );

    const components: LifeScoreComponent[] = [
      component("exercise", exerciseScore, `${exerciseMinutes}분 운동, ${steps.toLocaleString("ko-KR")}걸음`),
      component("sleep", sleepScore, `${sleepHours.toFixed(1)}시간 수면`),
      component("focus", focusScore, `${studyMinutes + readingMinutes}분 목표 학습`),
      component("distraction", distractionScore, `SNS/영상/게임 ${snsMinutes + youtubeMinutes + gameMinutes}분`),
      component("recovery", recoveryScore, lateSnacks > 0 ? "야식 1회 감지" : "야식 없음"),
    ];

    return {
      today,
      week: Math.round(clamp(today - 3 + exerciseMinutes / 30)),
      month: Math.round(clamp(today - 7 + studyMinutes / 45)),
      topPercent: Math.round(clamp(100 - today * 1.08, 6, 72)),
      components,
      calculatedAt: new Date().toISOString(),
    };
  }
}
