import { CHALLENGE_IDS, TEAM_IDS } from "@/lib/config";
import { createEmptyEntry } from "@/lib/initialState";
import type { ChallengeState, GameData, Session, TeamId } from "@/lib/types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Cắt bỏ mọi thứ người xem không có quyền thấy. Chạy ở server, ngay trước khi
 * trả JSON — trình duyệt không bao giờ nhận được dữ liệu thừa để mà lộ.
 */
export function redactForSession(
  source: GameData,
  session: Session | null,
): GameData {
  const data = clone(source);

  // pinHash không bao giờ rời khỏi server, kể cả với Game Master.
  data.gmPinHash = "";
  data.sessionEpoch = 0;
  for (const id of TEAM_IDS) data.teams[id].pinHash = "";

  if (session?.role === "GM") return data;

  const own = session?.role === "CARE_TEAM" ? session.teamId : null;

  // Đấu giá diễn ra trên sân khấu, nên khi đã chốt xong thì Booster ai cầm
  // là thông tin công khai — màn LED được phép hiện.
  const auctionSettled = data.auction.phase === "DONE";

  for (const id of TEAM_IDS) {
    if (id === own) continue;
    const team = data.teams[id];
    // Tên, màu, điểm đã công bố và Booster là thông tin sân khấu — giữ lại.
    // Energy nội bộ là dữ liệu chiến thuật — bỏ.
    team.currentEnergy = 0;
    team.redacted = true;
    if (!own && !auctionSettled) {
      team.boosterOwned = null;
      team.boosterUsed = false;
    }
    if (!own) team.boosterActivatedAtChallenge = null;
  }

  for (const challengeId of CHALLENGE_IDS) {
    const challenge: ChallengeState = data.challenges[challengeId];
    for (const teamId of TEAM_IDS) {
      if (teamId === own) continue;
      challenge.entries[teamId] = createEmptyEntry();
    }
  }

  for (const teamId of TEAM_IDS) {
    if (teamId === own) continue;
    data.auction.teams[teamId] = {
      energySnapshot: 0,
      auctionFund: 0,
      auctionReservedEnergy: 0,
      bids: { ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 0 },
      // Việc "đã nộp phiếu hay chưa" là thông tin điều phối, không phải chiến thuật.
      submitted: data.auction.teams[teamId].submitted,
    };
  }

  // Nhật ký chứa toàn bộ số liệu của cả 4 đội.
  data.auditLog = [];

  if (!own) {
    // Khách xem scoreboard: chỉ cần bảng điểm, không cần diễn biến.
    for (const challengeId of CHALLENGE_IDS) {
      data.challenges[challengeId].entries = clone(
        data.challenges[challengeId].entries,
      );
      for (const teamId of TEAM_IDS) {
        data.challenges[challengeId].entries[teamId] = createEmptyEntry();
      }
    }
    data.auction.lots = clone(data.auction.lots);
  }

  return data;
}

/** Danh sách để dựng màn "BẠN LÀ AI?" — không kèm bất kỳ số liệu nào. */
export function rosterOf(data: GameData) {
  return TEAM_IDS.map((id) => ({
    id: id as TeamId,
    name: data.teams[id].name,
    color: data.teams[id].color,
  }));
}
