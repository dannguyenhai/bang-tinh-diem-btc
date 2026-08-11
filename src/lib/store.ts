"use client";

import { create } from "zustand";
import type { GameAction } from "./actions";
import { createInitialGameData } from "./initialState";
import { GAME_ROW_ID, supabase } from "./supabase";
import type { GameData, Session, SyncStatus, TeamId } from "./types";

export interface RosterEntry {
  id: TeamId;
  name: string;
  color: string;
}

interface StatePayload {
  session?: Session | null;
  version: number;
  roster: RosterEntry[];
  data: GameData;
}

interface StoreState {
  data: GameData;
  roster: RosterEntry[];
  version: number;
  status: SyncStatus;
  error: string | null;
  session: Session | null;
  hydrated: boolean;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  dispatch: (action: GameAction) => Promise<boolean>;
  login: (
    role: "GM" | "CARE_TEAM",
    teamId: TeamId | null,
    pin: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setError: (message: string) => void;
}

let initPromise: Promise<void> | null = null;
let realtimeReady = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body?.error ?? `Máy chủ trả về lỗi ${response.status}.`;
  } catch {
    return `Máy chủ trả về lỗi ${response.status}.`;
  }
}

export const useGameStore = create<StoreState>((set, get) => ({
  data: createInitialGameData(),
  roster: [],
  version: 0,
  status: "connecting",
  error: null,
  session: null,
  hydrated: false,

  refresh: async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) {
        set({ status: "error", error: await readError(response) });
        return;
      }
      const payload = (await response.json()) as StatePayload;
      set({
        data: payload.data,
        roster: payload.roster,
        version: payload.version,
        session: payload.session ?? null,
        status: "online",
        hydrated: true,
      });
    } catch {
      set({ status: "error", error: "Mất kết nối tới máy chủ." });
    }
  },

  init: async () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      await get().refresh();
      set({ hydrated: true });

      // Bảng nhịp chỉ chứa số version — nghe được mà không lộ dữ liệu nào.
      if (supabase && !realtimeReady) {
        realtimeReady = true;
        supabase
          .channel("game_pulse_sync")
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "game_pulse",
              filter: `id=eq.${GAME_ROW_ID}`,
            },
            (payload) => {
              const next = payload.new as { version?: number };
              if (!next?.version || next.version <= get().version) return;
              void get().refresh();
            },
          )
          .subscribe();
      }

      if (typeof window !== "undefined" && !pollTimer) {
        // Lưới an toàn khi realtime rớt giữa buổi.
        pollTimer = setInterval(() => {
          if (document.visibilityState === "visible") void get().refresh();
        }, 8000);
        window.addEventListener("focus", () => void get().refresh());
      }
    })();
    return initPromise;
  },

  dispatch: async (action) => {
    set({ status: "saving", error: null });
    try {
      const response = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        const message = await readError(response);
        set({ status: "online", error: message });
        if (response.status === 401) {
          set({ session: null });
        }
        // Đồng bộ lại để màn hình khớp với dữ liệu thật trên máy chủ.
        void get().refresh();
        return false;
      }

      const payload = (await response.json()) as StatePayload;
      set({
        data: payload.data,
        roster: payload.roster,
        version: payload.version,
        status: "online",
      });
      return true;
    } catch {
      set({ status: "error", error: "Không gửi được thao tác lên máy chủ." });
      return false;
    }
  },

  login: async (role, teamId, pin) => {
    set({ status: "saving", error: null });
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, teamId, pin }),
      });
      if (!response.ok) {
        set({ status: "online", error: await readError(response) });
        return false;
      }
      const payload = (await response.json()) as StatePayload;
      set({
        data: payload.data,
        roster: payload.roster,
        version: payload.version,
        session: payload.session ?? null,
        status: "online",
      });
      return true;
    } catch {
      set({ status: "error", error: "Không kết nối được máy chủ." });
      return false;
    }
  },

  logout: async () => {
    await fetch("/api/logout", { method: "POST" });
    set({ session: null });
    await get().refresh();
  },

  clearError: () => set({ error: null }),
  setError: (message) => set({ error: message }),
}));

export function useTeam(teamId: TeamId | null) {
  return useGameStore((s) => (teamId ? s.data.teams[teamId] : null));
}
