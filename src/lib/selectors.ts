import { CHALLENGE_IDS, TEAM_IDS } from "./config";
import type { ChallengeId, GameData, TeamId } from "./types";

/** Thử thách đang được điều hành: vòng nhỏ nhất chưa công bố xong. */
export function getActiveChallengeId(data: GameData): ChallengeId | null {
  for (const id of CHALLENGE_IDS) {
    const status = data.challenges[id].status;
    if (status !== "IDLE" && status !== "PUBLISHED") return id;
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
