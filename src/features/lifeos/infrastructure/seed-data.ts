import type { Assistant, BehaviorLog, Goal, UserProfile } from "../domain/entities";

function isoDate(daysFromNow: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export const seedUser: UserProfile = {
  id: "user_demo",
  email: "demo@lifeos.ai",
  name: "Luna",
  createdAt: isoDate(-28),
  plan: "PREMIUM",
};

export const seedAssistant: Assistant = {
  id: "assistant_demo",
  userId: seedUser.id,
  persona: "future_self",
  name: "Mira",
  personality: "Calm, exacting, and optimistic",
  voice: "Warm strategic coach",
  avatar: "/lifeos-avatar.svg",
  level: 14,
  experience: 6420,
};

export const seedGoals: Goal[] = [
  {
    id: "goal_weight",
    userId: seedUser.id,
    title: "체중감량 5kg",
    description: "야식과 SNS 시간을 줄이고 주 5회 운동 루틴을 만든다.",
    deadline: isoDate(74),
    priority: "high",
    createdAt: isoDate(-18),
  },
  {
    id: "goal_english",
    userId: seedUser.id,
    title: "영어회화",
    description: "매일 30분 스피킹과 주 2회 회화 세션을 유지한다.",
    deadline: isoDate(116),
    priority: "medium",
    createdAt: isoDate(-10),
  },
  {
    id: "goal_study",
    userId: seedUser.id,
    title: "AI SaaS 공부",
    description: "제품 설계, API, 데이터 모델링을 매일 90분 학습한다.",
    deadline: isoDate(42),
    priority: "high",
    createdAt: isoDate(-7),
  },
];

export const seedBehaviorLogs: BehaviorLog[] = [
  {
    id: "log_sleep",
    userId: seedUser.id,
    type: "sleep_hours",
    value: 6.4,
    source: "healthkit",
    createdAt: isoDate(0, 7),
  },
  {
    id: "log_exercise",
    userId: seedUser.id,
    type: "exercise_minutes",
    value: 38,
    source: "health_connect",
    createdAt: isoDate(0, 8),
  },
  {
    id: "log_steps",
    userId: seedUser.id,
    type: "steps",
    value: 8240,
    source: "health_connect",
    createdAt: isoDate(0, 20),
  },
  {
    id: "log_study",
    userId: seedUser.id,
    type: "study_minutes",
    value: 72,
    source: "manual",
    createdAt: isoDate(0, 21),
  },
  {
    id: "log_reading",
    userId: seedUser.id,
    type: "reading_minutes",
    value: 24,
    source: "manual",
    createdAt: isoDate(0, 22),
  },
  {
    id: "log_sns",
    userId: seedUser.id,
    type: "sns_minutes",
    value: 96,
    source: "screen_time",
    createdAt: isoDate(0, 22),
  },
  {
    id: "log_youtube",
    userId: seedUser.id,
    type: "youtube_minutes",
    value: 88,
    source: "usage_stats",
    createdAt: isoDate(0, 22),
  },
  {
    id: "log_game",
    userId: seedUser.id,
    type: "game_minutes",
    value: 18,
    source: "usage_stats",
    createdAt: isoDate(0, 23),
  },
  {
    id: "log_snack",
    userId: seedUser.id,
    type: "late_snack_count",
    value: 1,
    source: "manual",
    createdAt: isoDate(0, 23),
  },
];
