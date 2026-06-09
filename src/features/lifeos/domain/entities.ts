export type AssistantPersona = "ceo" | "fitness_coach" | "drill_sergeant" | "butler" | "future_self";

export type GoalPriority = "low" | "medium" | "high";

export type BehaviorType =
  | "exercise_minutes"
  | "sleep_hours"
  | "study_minutes"
  | "reading_minutes"
  | "sns_minutes"
  | "game_minutes"
  | "youtube_minutes"
  | "steps"
  | "late_snack_count";

export type BehaviorSource =
  | "manual"
  | "usage_stats"
  | "health_connect"
  | "screen_time"
  | "healthkit"
  | "calendar";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  plan: "FREE" | "PREMIUM" | "VIP";
}

export interface Assistant {
  id: string;
  userId: string;
  persona: AssistantPersona;
  name: string;
  personality: string;
  voice: string;
  avatar: string;
  level: number;
  experience: number;
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  deadline: string;
  priority: GoalPriority;
  createdAt: string;
}

export interface BehaviorLog {
  id: string;
  userId: string;
  type: BehaviorType;
  value: number;
  source: BehaviorSource;
  createdAt: string;
}

export interface LifeScoreComponent {
  key: "exercise" | "sleep" | "focus" | "distraction" | "recovery";
  label: string;
  score: number;
  impact: string;
}

export interface LifeScoreResult {
  today: number;
  week: number;
  month: number;
  topPercent: number;
  components: LifeScoreComponent[];
  calculatedAt: string;
}

export interface SavedLifeScore {
  id: string;
  userId: string;
  score: number;
  date: string;
  createdAt: string;
}

export interface GoalProbability {
  goalId: string;
  probability: number;
  confidence: "low" | "medium" | "high";
  trend: "up" | "flat" | "down";
  reasons: string[];
}

export interface HabitInterference {
  id: string;
  goalId: string;
  behavior: string;
  severity: "low" | "medium" | "high";
  priority: number;
  evidence: string;
  replacement: string;
}

export interface ScheduleBlock {
  id: string;
  start: string;
  end: string;
  title: string;
  intent: "sleep" | "work" | "exercise" | "focus" | "recovery" | "review";
  goalId?: string;
}

export interface CoachingResponse {
  problem: string;
  insight: string;
  today_action: string;
  motivation: string;
}

export interface Intervention {
  shouldSend: boolean;
  title: string;
  message: string;
  probabilityDelta: number;
  trigger: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  sentAt: string | null;
  createdAt: string;
}

export interface CharacterReward {
  id: string;
  assistantId: string;
  type: "background" | "item" | "evolution" | "experience";
  title: string;
  unlockedAt: string;
}

export interface PushToken {
  id: string;
  userId: string;
  token: string;
  tokenHash?: string;
  platform: "ios" | "android" | "web";
  provider: "fcm";
  encrypted?: boolean;
  createdAt: string;
}

export interface LifeOSSnapshot {
  user: UserProfile;
  assistant: Assistant;
  goals: Goal[];
  behaviorLogs: BehaviorLog[];
  lifeScore: LifeScoreResult;
  probabilities: GoalProbability[];
  interferences: HabitInterference[];
  schedule: ScheduleBlock[];
  coach: CoachingResponse;
  intervention: Intervention;
  notifications: Notification[];
}

export interface CreateGoalInput {
  title: string;
  description: string;
  deadline: string;
  priority: GoalPriority;
}

export interface CreateBehaviorLogInput {
  type: BehaviorType;
  value: number;
  source: BehaviorSource;
  createdAt?: string;
}

export interface CreateNotificationInput {
  title: string;
  message: string;
  sentAt?: string | null;
}

export interface CreatePushTokenInput {
  token: string;
  tokenHash?: string;
  platform: PushToken["platform"];
  provider?: PushToken["provider"];
  encrypted?: boolean;
}
