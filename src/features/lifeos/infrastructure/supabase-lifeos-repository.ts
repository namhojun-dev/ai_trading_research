import type { SupabaseClient } from "@supabase/supabase-js";
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
} from "../domain/entities";
import type { LifeOSRepository } from "../domain/ports";
import { seedAssistant, seedUser } from "./seed-data";

type GoalRow = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  deadline: string;
  priority: Goal["priority"];
  created_at: string;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  plan: UserProfile["plan"];
  created_at: string;
};

type BehaviorLogRow = {
  id: string;
  user_id: string;
  type: BehaviorLog["type"];
  value: number;
  source: BehaviorLog["source"];
  created_at: string;
};

type AssistantRow = {
  id: string;
  user_id: string;
  persona: Assistant["persona"];
  name: string;
  personality: string;
  voice: string;
  avatar: string | null;
  level: number;
  experience: number;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  sent_at: string | null;
  created_at: string;
};

type PushTokenRow = {
  id: string;
  user_id: string;
  token: string;
  token_hash: string | null;
  platform: PushToken["platform"];
  provider: PushToken["provider"];
  encrypted: boolean | null;
  created_at: string;
};

type LifeScoreRow = {
  id: string;
  user_id: string;
  score: number;
  date: string;
  created_at: string;
};

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    deadline: row.deadline,
    priority: row.priority,
    createdAt: row.created_at,
  };
}

function mapBehaviorLog(row: BehaviorLogRow): BehaviorLog {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    value: Number(row.value),
    source: row.source,
    createdAt: row.created_at,
  };
}

function mapAssistant(row: AssistantRow): Assistant {
  return {
    id: row.id,
    userId: row.user_id,
    persona: row.persona,
    name: row.name,
    personality: row.personality,
    voice: row.voice,
    avatar: row.avatar ?? "/lifeos-avatar.svg",
    level: row.level,
    experience: row.experience,
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

function mapPushToken(row: PushTokenRow): PushToken {
  return {
    id: row.id,
    userId: row.user_id,
    token: row.token,
    tokenHash: row.token_hash ?? undefined,
    platform: row.platform,
    provider: row.provider,
    encrypted: row.encrypted ?? false,
    createdAt: row.created_at,
  };
}

function mapSavedLifeScore(row: LifeScoreRow): SavedLifeScore {
  return {
    id: row.id,
    userId: row.user_id,
    score: Number(row.score),
    date: row.date,
    createdAt: row.created_at,
  };
}

export class SupabaseLifeOSRepository implements LifeOSRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getCurrentUser(): Promise<UserProfile> {
    const demoUserId = process.env.LIFEOS_DEMO_USER_ID ?? seedUser.id;
    const { data, error } = await this.supabase
      .from("users")
      .select("id,email,name,plan,created_at")
      .eq("id", demoUserId)
      .maybeSingle<UserRow>();

    if (error || !data) {
      return seedUser;
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      createdAt: data.created_at,
      plan: data.plan,
    };
  }

  async getAssistant(userId: string): Promise<Assistant> {
    const { data, error } = await this.supabase.from("assistants").select("*").eq("user_id", userId).maybeSingle<AssistantRow>();
    if (error || !data) return { ...seedAssistant, userId };
    return mapAssistant(data);
  }

  async listGoals(userId: string): Promise<Goal[]> {
    const { data, error } = await this.supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).returns<GoalRow[]>();
    if (error || !data) return [];
    return data.map(mapGoal);
  }

  async listBehaviorLogs(userId: string): Promise<BehaviorLog[]> {
    const { data, error } = await this.supabase
      .from("behavior_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<BehaviorLogRow[]>();

    if (error || !data) return [];
    return data.map(mapBehaviorLog);
  }

  async listNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await this.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<NotificationRow[]>();

    if (error || !data) return [];
    return data.map(mapNotification);
  }

  async listPushTokens(userId: string): Promise<PushToken[]> {
    const { data, error } = await this.supabase
      .from("push_tokens")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .returns<PushTokenRow[]>();

    if (error || !data) return [];
    return data.map(mapPushToken);
  }

  async createGoal(userId: string, input: CreateGoalInput): Promise<Goal> {
    const { data, error } = await this.supabase
      .from("goals")
      .insert({
        user_id: userId,
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        priority: input.priority,
      })
      .select("*")
      .single<GoalRow>();

    if (error) throw error;
    return mapGoal(data);
  }

  async createBehaviorLog(userId: string, input: CreateBehaviorLogInput): Promise<BehaviorLog> {
    const { data, error } = await this.supabase
      .from("behavior_logs")
      .insert({
        user_id: userId,
        type: input.type,
        value: input.value,
        source: input.source,
        created_at: input.createdAt ?? new Date().toISOString(),
      })
      .select("*")
      .single<BehaviorLogRow>();

    if (error) throw error;
    return mapBehaviorLog(data);
  }

  async createNotification(userId: string, input: CreateNotificationInput): Promise<Notification> {
    const { data, error } = await this.supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: input.title,
        message: input.message,
        sent_at: input.sentAt ?? null,
      })
      .select("*")
      .single<NotificationRow>();

    if (error) throw error;
    return mapNotification(data);
  }

  async createPushToken(userId: string, input: CreatePushTokenInput): Promise<PushToken> {
    const { data, error } = await this.supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          token: input.token,
          token_hash: input.tokenHash,
          platform: input.platform,
          provider: input.provider ?? "fcm",
          encrypted: input.encrypted ?? false,
        },
        { onConflict: "user_id,token_hash" },
      )
      .select("*")
      .single<PushTokenRow>();

    if (error) throw error;
    return mapPushToken(data);
  }

  async saveLifeScore(userId: string, score: number, date: string): Promise<SavedLifeScore> {
    const { data, error } = await this.supabase
      .from("life_scores")
      .upsert(
        {
          user_id: userId,
          score,
          date,
        },
        { onConflict: "user_id,date" },
      )
      .select("*")
      .single<LifeScoreRow>();

    if (error) throw error;
    return mapSavedLifeScore(data);
  }

  async saveAssistant(assistant: Assistant): Promise<Assistant> {
    const { data, error } = await this.supabase
      .from("assistants")
      .upsert({
        id: assistant.id,
        user_id: assistant.userId,
        persona: assistant.persona,
        name: assistant.name,
        personality: assistant.personality,
        voice: assistant.voice,
        avatar: assistant.avatar,
        level: assistant.level,
        experience: assistant.experience,
      })
      .select("*")
      .single<AssistantRow>();

    if (error) throw error;
    return mapAssistant(data);
  }
}
