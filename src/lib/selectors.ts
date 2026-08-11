import { CHALLENGE_IDS, TEAM_IDS } from "./config";
import type { ChallengeId, GameData, TeamId } from "./types";

/**
 * Thử thách đang được điều hành.
 *
 * Ưu tiên vòng còn dở việc. Nếu không còn vòng nào đang chạy thì lấy vòng đã
 * khóa gần nhất — GM vẫn cần chỗ để soát lại, mở lại, hoặc mở vòng kế tiếp.
 * Một vòng đã khóa không được chặn vòng sau: Publish là việc của MC, không
 * phải điều kiện để chơi tiếp.
 */
export function getActiveChallengeId(data: GameData): ChallengeId | null {
  for (const id of CHALLENGE_IDS) {
    const status = data.challenges[id].status;
    if (status !== "IDLE" && status !== "PUBLISHED" && status !== "RESULT_LOCKED") {
      return id;
    }
  }
  for (let i = CHALLENGE_IDS.length - 1; i >= 0; i -= 1) {
    if (data.challenges[CHALLENGE_IDS[i]].status === "RESULT_LOCKED") {
      return CHALLENGE_IDS[i];
    }
  }
  return null;
}

/** Vòng tiếp theo GM có thể mở. */
export function getNextChallengeId(data: GameData): ChallengeId | null {
  for (const id of CHALLENGE_IDS) {
    if (data.challenges[id].status === "IDLE") return id;
  }
  return null;
}

export function getRanking(data: GameData, useCurrent = false) {
  return [...TEAM_IDS]
    .map((id) => data.teams[id])
    .sort((a, b) =>
      useCurrent
        ? b.currentEnergy - a.currentEnergy
        : b.publishedEnergy - a.publishedEnergy,
    );
}

export function hasUnpublishedChanges(data: GameData): boolean {
  return TEAM_IDS.some(
    (id) => data.teams[id].currentEnergy !== data.teams[id].publishedEnergy,
  );
}

/**
 * Còn gì để công bố hay không. Một vòng đã khóa nhưng chưa công bố vẫn cần
 * bấm Publish — kể cả khi Energy không đổi (TT3 mà cả 4 đội cùng thua), vì
 * đó là bước đưa vòng sang trạng thái PUBLISHED.
 */
export function hasPendingPublish(data: GameData): boolean {
  return (
    hasUnpublishedChanges(data) ||
    CHALLENGE_IDS.some((id) => data.challenges[id].status === "RESULT_LOCKED")
  );
}

export function isAuctionActive(data: GameData): boolean {
  return data.auction.phase !== "IDLE" && data.auction.phase !== "DONE";
}

export function getCurrentLotBooster(data: GameData) {
  const { order, currentLotIndex } = data.auction;
  return order[currentLotIndex] ?? null;
}

export function nextFallbackTeam(data: GameData): TeamId | null {
  return (
    data.auction.fallbackOrder.find((id) => !data.teams[id].boosterOwned) ?? null
  );
}
