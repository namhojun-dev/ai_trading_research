export const LIFEOS_MESSAGES = {
  ko: {
    appName: "LifeOS AI",
    dashboardTitle: "목표 달성 확률을 운영하는 대시보드",
    lifeScore: "Life Score",
    goalProbability: "목표 달성 확률",
    habitInterference: "방해 행동",
    schedule: "오늘 일정",
    coaching: "오늘의 코칭",
    intervention: "실시간 개입",
  },
  en: {
    appName: "LifeOS AI",
    dashboardTitle: "Operate your goal probability",
    lifeScore: "Life Score",
    goalProbability: "Goal Probability",
    habitInterference: "Habit Interference",
    schedule: "Today Schedule",
    coaching: "Today Coaching",
    intervention: "Realtime Intervention",
  },
} as const;

export type LifeOSLocale = keyof typeof LIFEOS_MESSAGES;

export function getLifeOSMessages(locale: string | null | undefined) {
  return LIFEOS_MESSAGES[locale === "en" ? "en" : "ko"];
}
