import {
  BOOSTER_IDS,
  CHALLENGES,
  CHALLENGE_IDS,
  DEFAULT_START_ENERGY,
  DEFAULT_TEAMS,
  GM_DEFAULT_PIN,
  TEAM_IDS,
} from "./config";
import type {
  AuctionLot,
  AuctionState,
  BoosterId,
  ChallengeId,
  ChallengeState,
  GameData,
  Team,
  TeamChallengeEntry,
  TeamId,
} from "./types";

export const SCHEMA_VERSION = 1;

export function createEmptyEntry(): TeamChallengeEntry {
  return {
    energyBefore: null,
    maxInvestment: 0,
    investment: null,
    investmentSubmitted: false,
    preBoosterActivation: false,
    result: null,
    reactiveBoosterActivation: null,
    projectedEnergy: null,
    energyAfter: null,
  };
}

export function createChallengeState(id: ChallengeId): ChallengeState {
  const entries = {} as Record<TeamId, TeamChallengeEntry>;
  for (const teamId of TEAM_IDS) entries[teamId] = createEmptyEntry();
  return { id, status: "IDLE", entries };
}

export function createLot(booster: BoosterId): AuctionLot {
  return {
    booster,
    status: "PENDING",
    candidates: [],
    tieCandidates: [],
    tieSlots: 0,
    currentBid: 0,
    currentLeader: null,
    winner: null,
    winningPrice: null,
    note: null,
  };
}

export function createAuctionState(): AuctionState {
  const teams = {} as AuctionState["teams"];
  for (const teamId of TEAM_IDS) {
    teams[teamId] = {
      energySnapshot: 0,
      auctionFund: 0,
      auctionReservedEnergy: 0,
      bids: { ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 0 },
      submitted: false,
    };
  }
  const lots = {} as Record<BoosterId, AuctionLot>;
  for (const booster of BOOSTER_IDS) lots[booster] = createLot(booster);
  return {
    phase: "IDLE",
    teams,
    order: [],
    currentLotIndex: 0,
    lots,
    fallbackOrder: [],
  };
}

/**
 * `hashPin` chỉ được truyền vào từ server khi seed ván chơi. Ở trình duyệt,
 * hàm này tạo state rỗng với hash trống — không PIN nào khớp được.
 */
export function createInitialGameData(
  startEnergy = DEFAULT_START_ENERGY,
  hashPin: (pin: string) => string = () => "",
): GameData {
  const teams = {} as Record<TeamId, Team>;
  for (const preset of DEFAULT_TEAMS) {
    teams[preset.id] = {
      id: preset.id,
      name: preset.name,
      color: preset.color,
      pinHash: hashPin(preset.pin),
      currentEnergy: startEnergy,
      publishedEnergy: startEnergy,
      boosterOwned: null,
      boosterUsed: false,
      boosterActivatedAtChallenge: null,
    };
  }

  const challenges = {} as Record<ChallengeId, ChallengeState>;
  for (const id of CHALLENGE_IDS) challenges[id] = createChallengeState(id);

  return {
    schemaVersion: SCHEMA_VERSION,
    gmPinHash: hashPin(GM_DEFAULT_PIN),
    energyOpened: false,
    teams,
    challenges,
    auction: createAuctionState(),
    auditLog: [],
  };
}

/** Bù các field còn thiếu khi dữ liệu cũ hơn schema hiện tại. */
export function normalizeGameData(raw: unknown): GameData {
  const fallback = createInitialGameData();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<GameData>;

  const teams = { ...fallback.teams };
  if (data.teams) {
    for (const id of TEAM_IDS) {
      if (data.teams[id]) {
        teams[id] = {
          ...fallback.teams[id],
          ...data.teams[id],
          // Bảng màu do config quyết định, không lấy theo dữ liệu đã lưu.
          color: fallback.teams[id].color,
        };
      }
    }
  }

  const challenges = { ...fallback.challenges };
  if (data.challenges) {
    for (const id of CHALLENGE_IDS) {
      const incoming = data.challenges[id];
      if (!incoming) continue;
      const entries = { ...fallback.challenges[id].entries };
      for (const teamId of TEAM_IDS) {
        if (incoming.entries?.[teamId]) {
          entries[teamId] = { ...createEmptyEntry(), ...incoming.entries[teamId] };
        }
      }
      challenges[id] = { id, status: incoming.status ?? "IDLE", entries };
    }
  }

  const auction = data.auction
    ? {
        ...createAuctionState(),
        ...data.auction,
        teams: { ...createAuctionState().teams, ...data.auction.teams },
        lots: { ...createAuctionState().lots, ...data.auction.lots },
      }
    : fallback.auction;

  return {
    schemaVersion: SCHEMA_VERSION,
    gmPinHash: data.gmPinHash ?? fallback.gmPinHash,
    energyOpened: data.energyOpened ?? false,
    teams,
    challenges,
    auction,
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
  };
}

export { CHALLENGES };
