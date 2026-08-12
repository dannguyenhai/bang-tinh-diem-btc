import { NextResponse } from "next/server";
import { TEAM_IDS } from "@/lib/config";
import { verifyPin } from "@/lib/server/crypto";
import { loadGame } from "@/lib/server/gameStore";
import { redactForSession, rosterOf } from "@/lib/server/redact";
import { writeSession } from "@/lib/server/session";
import type { Session, TeamId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trả lời chậm một nhịp để việc dò PIN 4 chữ số không thể chạy hàng loạt. */
function delay() {
  return new Promise((resolve) => setTimeout(resolve, 400));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      role?: string;
      teamId?: string;
      pin?: string;
    };
    const pin = String(body.pin ?? "");
    const { data, version } = await loadGame();

    let session: Session | null = null;

    if (body.role === "GM") {
      if (verifyPin(pin, data.gmPinHash)) {
        session = { role: "GM", teamId: null, name: "Game Master", epoch: data.sessionEpoch };
      }
    } else if (body.role === "CARE_TEAM") {
      const teamId = body.teamId as TeamId;
      if (TEAM_IDS.includes(teamId) && verifyPin(pin, data.teams[teamId].pinHash)) {
        session = {
          role: "CARE_TEAM",
          teamId,
          name: data.teams[teamId].name,
          epoch: data.sessionEpoch,
        };
      }
    }

    if (!session) {
      await delay();
      return NextResponse.json({ error: "PIN không đúng." }, { status: 401 });
    }

    await writeSession(session);
    return NextResponse.json({
      session,
      version,
      roster: rosterOf(data),
      data: redactForSession(data, session),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Lỗi máy chủ." },
      { status: 500 },
    );
  }
}
