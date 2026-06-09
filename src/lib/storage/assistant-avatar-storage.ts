import { getSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

const AVATAR_BUCKET = "assistant-avatars";

export function hasAssistantAvatarStorageConfig() {
  return hasSupabaseServerConfig();
}

export async function uploadAssistantAvatar(input: {
  userId: string;
  fileName: string;
  contentType: string;
  base64: string;
}) {
  const supabase = getSupabaseServerClient();
  const extension = input.fileName.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  const path = `${input.userId}/${Date.now()}.${extension}`;
  const body = Buffer.from(input.base64, "base64");

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: input.contentType,
    upsert: true,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return {
    bucket: AVATAR_BUCKET,
    path,
    publicUrl: data.publicUrl,
  };
}
