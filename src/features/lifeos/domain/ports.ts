import type {
  Assistant,
  BehaviorLog,
  CreateBehaviorLogInput,
  CreateGoalInput,
  CreateNotificationInput,
  CreatePushTokenInput,
  Goal,
  Notification,
  PushToken,
  SavedLifeScore,
  UserProfile,
} from "./entities";

export interface LifeOSRepository {
  getCurrentUser(): Promise<UserProfile>;
  getAssistant(userId: string): Promise<Assistant>;
  listGoals(userId: string): Promise<Goal[]>;
  listBehaviorLogs(userId: string): Promise<BehaviorLog[]>;
  listNotifications(userId: string): Promise<Notification[]>;
  listPushTokens(userId: string): Promise<PushToken[]>;
  createGoal(userId: string, input: CreateGoalInput): Promise<Goal>;
  createBehaviorLog(userId: string, input: CreateBehaviorLogInput): Promise<BehaviorLog>;
  createNotification(userId: string, input: CreateNotificationInput): Promise<Notification>;
  createPushToken(userId: string, input: CreatePushTokenInput): Promise<PushToken>;
  saveLifeScore(userId: string, score: number, date: string): Promise<SavedLifeScore>;
  saveAssistant(assistant: Assistant): Promise<Assistant>;
}
