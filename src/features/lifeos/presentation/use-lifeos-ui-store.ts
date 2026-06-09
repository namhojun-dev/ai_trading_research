import { create } from "zustand";
import type { LifeOSLocale } from "@/lib/i18n/lifeos";

export type LifeOSViewId = "dashboard" | "goals" | "assistant" | "analytics" | "schedule" | "profile";

interface LifeOSUIState {
  activeView: LifeOSViewId;
  locale: LifeOSLocale;
  setActiveView: (view: LifeOSViewId) => void;
  setLocale: (locale: LifeOSLocale) => void;
  toggleLocale: () => void;
}

export const useLifeOSUIStore = create<LifeOSUIState>((set) => ({
  activeView: "dashboard",
  locale: "ko",
  setActiveView: (activeView) => set({ activeView }),
  setLocale: (locale) => set({ locale }),
  toggleLocale: () => set((state) => ({ locale: state.locale === "ko" ? "en" : "ko" })),
}));
