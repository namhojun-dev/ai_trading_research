import type { BehaviorLog, BehaviorType, Goal, HabitInterference } from "../domain/entities";

function valueFor(logs: BehaviorLog[], type: BehaviorType) {
  return logs.filter((log) => log.type === type).reduce((sum, log) => sum + log.value, 0);
}

export class HabitRemovalEngine {
  detect(goals: Goal[], logs: BehaviorLog[]): HabitInterference[] {
    const snsMinutes = valueFor(logs, "sns_minutes");
    const youtubeMinutes = valueFor(logs, "youtube_minutes");
    const gameMinutes = valueFor(logs, "game_minutes");
    const sleepHours = valueFor(logs, "sleep_hours");
    const lateSnacks = valueFor(logs, "late_snack_count");

    return goals
      .flatMap((goal) => {
        const items: HabitInterference[] = [];

        if (snsMinutes > 75) {
          items.push({
            id: `${goal.id}_sns`,
            goalId: goal.id,
            behavior: "SNS 과다 사용",
            severity: snsMinutes > 120 ? "high" : "medium",
            priority: Math.round(70 + snsMinutes / 4),
            evidence: `오늘 SNS ${snsMinutes}분 사용`,
            replacement: "점심 이후 SNS 앱 25분 제한",
          });
        }

        if (youtubeMinutes > 60) {
          items.push({
            id: `${goal.id}_youtube`,
            goalId: goal.id,
            behavior: "영상 시청 장기화",
            severity: youtubeMinutes > 100 ? "high" : "medium",
            priority: Math.round(74 + youtubeMinutes / 5),
            evidence: `YouTube ${youtubeMinutes}분 사용`,
            replacement: "목표 블록 전 10분 타이머만 허용",
          });
        }

        if (sleepHours < 7) {
          items.push({
            id: `${goal.id}_sleep`,
            goalId: goal.id,
            behavior: "수면 부족",
            severity: sleepHours < 6 ? "high" : "medium",
            priority: Math.round(88 - sleepHours * 4),
            evidence: `지난 수면 ${sleepHours.toFixed(1)}시간`,
            replacement: "23:30 조명 낮추기와 알림 차단",
          });
        }

        if (/체중|감량|다이어트|운동|마라톤/.test(`${goal.title} ${goal.description}`) && lateSnacks > 0) {
          items.push({
            id: `${goal.id}_snack`,
            goalId: goal.id,
            behavior: "야식",
            severity: "high",
            priority: 94,
            evidence: "체중 목표가 있는 날 야식 1회 기록",
            replacement: "21:30 단백질 간식 또는 무가당 차로 대체",
          });
        }

        if (gameMinutes > 45) {
          items.push({
            id: `${goal.id}_game`,
            goalId: goal.id,
            behavior: "게임 시간 증가",
            severity: "medium",
            priority: Math.round(55 + gameMinutes / 3),
            evidence: `게임 ${gameMinutes}분 사용`,
            replacement: "게임은 목표 완료 후 보상 슬롯으로 이동",
          });
        }

        return items;
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);
  }
}
