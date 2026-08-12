import { NextResponse } from "next/server";
import { loadGame } from "@/lib/server/gameStore";
import { redactForSession, rosterOf } from "@/lib/server/redact";
import { clearSession, isSessionCurrent, readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trả về ván chơi đã lọc theo đúng vai của người gọi. */
export async function GET() {
  try {
    const raw = await readSession();
    const { data, version } = await loadGame();

    // Ván chơi đã được khôi phục về mặc định — dọn cookie cũ đi cho sạch.
    const session = isSessionCurrent(raw, data) ? raw : null;
    if (raw && !session) await clearSession();

    return NextResponse.json(
      {
        session,
        version,
        roster: rosterOf(data),
        data: redactForSession(data, session),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}
