import { NextResponse } from "next/server";
import { loadGame } from "@/lib/server/gameStore";
import { redactForSession, rosterOf } from "@/lib/server/redact";
import { readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trả về ván chơi đã lọc theo đúng vai của người gọi. */
export async function GET() {
  try {
    const session = await readSession();
    const { data, version } = await loadGame();
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
