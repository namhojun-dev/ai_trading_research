import type { Goal, ScheduleBlock } from "../domain/entities";

export interface ScheduleInput {
  workStart?: string;
  workEnd?: string;
  sleepStart?: string;
  sleepEnd?: string;
}

function block(id: string, start: string, end: string, title: string, intent: ScheduleBlock["intent"], goalId?: string) {
  return { id, start, end, title, intent, goalId };
}

export class ScheduleEngine {
  generate(goals: Goal[], input: ScheduleInput = {}): ScheduleBlock[] {
    const primaryGoal = goals.find((goal) => goal.priority === "high") ?? goals[0];
    const secondaryGoal = goals.find((goal) => goal.id !== primaryGoal?.id) ?? goals[1];
    const workStart = input.workStart ?? "09:30";
    const workEnd = input.workEnd ?? "18:30";
    const sleepStart = input.sleepStart ?? "23:30";
    const sleepEnd = input.sleepEnd ?? "07:00";

    return [
      block("sleep", sleepStart, sleepEnd, "수면 보호", "sleep"),
      block("morning", "07:20", "08:05", primaryGoal ? `${primaryGoal.title} 실행 블록` : "목표 실행 블록", "exercise", primaryGoal?.id),
      block("planning", "08:10", "08:25", "AI 확률 점검", "review"),
      block("work", workStart, workEnd, "업무 집중", "work"),
      block("focus", "19:40", "20:40", secondaryGoal ? `${secondaryGoal.title} 딥워크` : "목표 딥워크", "focus", secondaryGoal?.id),
      block("recovery", "21:20", "21:45", "회복 루틴", "recovery"),
      block("review", "22:10", "22:25", "캐릭터 경험치 정산", "review"),
    ];
  }
}
