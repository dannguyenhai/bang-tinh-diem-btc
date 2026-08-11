import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const GAME_ROW_ID = process.env.NEXT_PUBLIC_GAME_ID || "default";

export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Client dùng chung cho toàn app. Anon key là loại public-safe, mọi ràng buộc
 * ghi/đọc nằm ở RLS phía Supabase (xem supabase/schema.sql).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;
