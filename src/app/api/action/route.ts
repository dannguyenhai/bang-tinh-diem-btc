import { NextResponse } from "next/server";
import type { GameAction } from "@/lib/actions";
import { GameError } from "@/lib/mutations";
import { ForbiddenError, applyAction } from "@/lib/server/dispatch";
import { loadGame, saveGame } from "@/lib/server/gameStore";
import { redactForSession, rosterOf } from "@/lib/server/redact";
import { readSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json(
      { error: "Phiên đăng nhập đã hết hạn. Đăng nhập lại giúp mình." },
      { status: 401 },
    );
  }

  let action: GameAction;
  try {
    action = (await request.json()) as GameAction;
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }
  if (!action || typeof action.type !== "string") {
    return NextResponse.json({ error: "Thiếu loại hành động." }, { status: 400 });
  }

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const { data, version } = await loadGame();
      applyAction(data, action, session);
      const nextVersion = await saveGame(data, version);

      if (nextVersion !== null) {
        return NextResponse.json({
          version: nextVersion,
          roster: rosterOf(data),
          data: redactForSession(data, session),
        });
      }
      // Thiết bị khác vừa ghi trước — đọc lại bản mới và áp lại hành động.
    }

    return NextResponse.json(
      { error: "Có thiết bị khác đang thao tác cùng lúc. Thử lại giúp mình." },
      { status: 409 },
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof GameError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}
