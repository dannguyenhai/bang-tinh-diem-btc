import type {
  BoosterId,
  ChallengeId,
  GameData,
  MatchResult,
  SealedBids,
  TeamId,
} from "./types";

/**
 * Tập hành động duy nhất mà server chấp nhận. Client không gửi state,
 * chỉ gửi ý định — server tự tính lại từ dữ liệu gốc.
 */
export type GameAction =
  | { type: "openEnergy"; energies: Record<TeamId, number> }
  | { type: "setTeamProfile"; teamId: TeamId; name?: string; pin?: string }
  | { type: "setGmPin"; pin: string }
  | { type: "openChallenge"; challengeId: ChallengeId }
  | {
      type: "submitInvestment";
      teamId: TeamId;
      challengeId: ChallengeId;
      investment: number;
      preBoosterActivation: boolean;
    }
  | { type: "lockInvestment"; challengeId: ChallengeId }
  | { type: "startResultEntry"; challengeId: ChallengeId }
  | {
      type: "setResult";
      teamId: TeamId;
      challengeId: ChallengeId;
      result: MatchResult;
    }
  | { type: "openBoosterResponse"; challengeId: ChallengeId }
  | {
      type: "setReactiveBooster";
      teamId: TeamId;
      challengeId: ChallengeId;
      use: boolean;
    }
  | { type: "closeBoosterResponse"; challengeId: ChallengeId }
  | { type: "goToReview"; challengeId: ChallengeId }
  | { type: "lockResult"; challengeId: ChallengeId }
  | { type: "reopenResult"; challengeId: ChallengeId; reason: string }
  | { type: "publishScoreboard" }
  | { type: "openSealedAuction" }
  | { type: "submitSealedBids"; teamId: TeamId; bids: SealedBids }
  | { type: "lockSealedAuction" }
  | { type: "orderAuctionLots" }
  | { type: "resolveTie"; booster: BoosterId; teamId: TeamId }
  | { type: "resolveTieRandom"; booster: BoosterId }
  | { type: "awardLotRandom"; booster: BoosterId }
  | {
      type: "placePublicBid";
      booster: BoosterId;
      teamId: TeamId;
      amount: number;
    }
  | { type: "awardLot"; booster: BoosterId; winner?: TeamId }
  | { type: "skipLot"; booster: BoosterId }
  | { type: "randomizeFallbackOrder" }
  | { type: "assignFallbackBooster"; teamId: TeamId; booster: BoosterId }
  | { type: "closeAuction" }
  | { type: "resetGame"; startEnergy: number }
  /** Xóa sạch mọi thứ, kể cả tên đội và PIN — về đúng trạng thái xuất xưởng. */
  | { type: "factoryReset"; startEnergy: number }
  | { type: "importState"; data: GameData };

export type ActionType = GameAction["type"];

/**
 * Hành động Care Team được phép gửi — và chỉ cho chính đội mình.
 * Mọi thứ khác chỉ Game Master mới chạy được.
 */
export const CARE_TEAM_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  "setTeamProfile",
  "submitInvestment",
  "setReactiveBooster",
  "submitSealedBids",
  "placePublicBid",
  "assignFallbackBooster",
]);

/** Các hành động mang teamId cần khớp với đội đang đăng nhập. */
export function actionTeamId(action: GameAction): TeamId | null {
  return "teamId" in action ? action.teamId : null;
}
