import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createInitialGameData, normalizeGameData } from "@/lib/initialState";
import type { GameData } from "@/lib/types";
import { hashPin } from "./crypto";

const GAME_ROW_ID = process.env.NEXT_PUBLIC_GAME_ID || "default";

let cached: SupabaseClient | null = null;

/**
 * Client service_role — bỏ qua RLS. Chỉ được import từ route handler,
 * "server-only" chặn nó lọt vào bundle trình duyệt.
 */
export function admin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong biến môi trường.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export interface LoadedGame {
  data: GameData;
  version: number;
}

/** Đọc ván chơi, tự seed ở lần chạy đầu tiên. */
export async function loadGame(): Promise<LoadedGame> {
  const db = admin();
  const { data: row, error } = await db
    .from("game_state")
    .select("state, version")
    .eq("id", GAME_ROW_ID)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (row) {
    return { data: normalizeGameData(row.state), version: Number(row.version) };
  }

  const seed = createInitialGameData(undefined, hashPin);
  const { error: insertError } = await db
    .from("game_state")
    .insert({ id: GAME_ROW_ID, state: seed, version: 1 });
  if (insertError) {
    // Một request khác vừa seed xong — đọc lại thay vì báo lỗi.
    const { data: retry } = await db
      .from("game_state")
      .select("state, version")
      .eq("id", GAME_ROW_ID)
      .maybeSingle();
    if (retry) {
      return {
        data: normalizeGameData(retry.state),
        version: Number(retry.version),
      };
    }
    throw new Error(insertError.message);
  }
  return { data: seed, version: 1 };
}

/**
 * Ghi kèm kiểm tra version. Trả về false khi có thiết bị khác ghi trước —
 * người gọi sẽ đọc lại và áp lại hành động.
 */
export async function saveGame(
  data: GameData,
  expectedVersion: number,
): Promise<number | null> {
  const nextVersion = expectedVersion + 1;
  const { data: rows, error } = await admin()
    .from("game_state")
    .update({
      state: data,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", GAME_ROW_ID)
    .eq("version", expectedVersion)
    .select("version");

  if (error) throw new Error(error.message);
  return rows && rows.length > 0 ? nextVersion : null;
}
