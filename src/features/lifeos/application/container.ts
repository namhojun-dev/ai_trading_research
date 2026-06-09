import { InMemoryLifeOSRepository } from "../infrastructure/in-memory-lifeos-repository";
import { SupabaseLifeOSRepository } from "../infrastructure/supabase-lifeos-repository";
import { LifeOSService } from "./lifeos-service";
import { getSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

type LifeOSGlobal = typeof globalThis & {
  __lifeOSService?: LifeOSService;
};

export function getLifeOSService() {
  const globalStore = globalThis as LifeOSGlobal;

  if (!globalStore.__lifeOSService) {
    const repository = hasSupabaseServerConfig()
      ? new SupabaseLifeOSRepository(getSupabaseServerClient())
      : new InMemoryLifeOSRepository();
    globalStore.__lifeOSService = new LifeOSService(repository);
  }

  return globalStore.__lifeOSService;
}
