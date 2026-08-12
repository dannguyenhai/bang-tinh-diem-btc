export type TeamId = "TEAM_1" | "TEAM_2" | "TEAM_3" | "TEAM_4";

export type BoosterId = "ALPHA" | "BETA" | "GAMMA" | "DELTA";

export type Role = "GM" | "CARE_TEAM";

export type ChallengeId = 1 | 2 | 3 | 4 | 5;

export type MatchResult = "WIN" | "LOSE";

/** Vòng đời của một thử thách. Không phải thử thách nào cũng đi qua đủ các bước. */
export type ChallengeStatus =
  | "IDLE"
  | "OPEN_FOR_INVESTMENT"
  | "PRE_GAME_LOCKED"
  | "RESULT_ENTRY"
  | "BOOSTER_RESPONSE"
  | "GM_REVIEW"
  | "RESULT_LOCKED"
  | "PUBLISHED";

export interface ChallengeConfig {
  id: ChallengeId;
  name: string;
  shortName: string;
  baseReward: number;
  investmentEnabled: boolean;
  boosterEnabled: boolean;
  participantType: string;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  /** Chỉ tồn tại phía server; luôn bị xóa trước khi trả về trình duyệt. */
  pinHash: string;
  currentEnergy: number;
  publishedEnergy: number;
  boosterOwned: BoosterId | null;
  boosterUsed: boolean;
  boosterActivatedAtChallenge: ChallengeId | null;
  /** Đội khác nhìn từ góc Care Team: số liệu chiến thuật đã bị giấu. */
  redacted?: boolean;
}

export interface TeamChallengeEntry {
  energyBefore: number | null;
  maxInvestment: number;
  investment: number | null;
  investmentSubmitted: boolean;
  /** Alpha / Gamma — phải chốt trước khi thi đấu. */
  preBoosterActivation: boolean;
  result: MatchResult | null;
  /** Beta / Delta — chỉ quyết định sau khi LOSE. */
  reactiveBoosterActivation: boolean | null;
  projectedEnergy: number | null;
  energyAfter: number | null;
}

export interface ChallengeState {
  id: ChallengeId;
  status: ChallengeStatus;
  entries: Record<TeamId, TeamChallengeEntry>;
}

export type AuctionPhase =
  | "IDLE"
  | "SEALED_OPEN"
  | "SEALED_LOCKED"
  | "RUNNING"
  | "FALLBACK"
  | "DONE";

export type SealedBids = Record<BoosterId, number>;

export interface AuctionTeamState {
  energySnapshot: number;
  auctionFund: number;
  auctionReservedEnergy: number;
  bids: SealedBids;
  submitted: boolean;
}

export type LotStatus =
  | "PENDING"
  | "TIE_BREAK"
  | "PUBLIC"
  | "AWARDED"
  | "SKIPPED";

export interface AuctionLot {
  booster: BoosterId;
  status: LotStatus;
  /** Top 2 đội đủ điều kiện vào vòng công khai. */
  candidates: TeamId[];
  /** Các đội hòa giá, tranh nhau số suất còn lại — GM bốc thăm ngoài sân khấu. */
  tieCandidates: TeamId[];
  tieSlots: number;
  currentBid: number;
  currentLeader: TeamId | null;
  winner: TeamId | null;
  winningPrice: number | null;
  note: string | null;
}

export interface AuctionState {
  phase: AuctionPhase;
  teams: Record<TeamId, AuctionTeamState>;
  order: BoosterId[];
  currentLotIndex: number;
  lots: Record<BoosterId, AuctionLot>;
  fallbackOrder: TeamId[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: Role | "SYSTEM";
  teamId: TeamId | null;
  challengeId: ChallengeId | null;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
}

export interface Session {
  role: Role;
  teamId: TeamId | null;
  name: string;
  /**
   * Số hiệu phiên tại lúc đăng nhập. Khôi phục toàn bộ sẽ tăng số này lên,
   * làm mọi cookie đã phát trước đó thành vô hiệu — kể cả trên máy khác.
   */
  epoch: number;
}

/** Toàn bộ dữ liệu ván chơi — đúng một object này được đồng bộ giữa các thiết bị. */
export interface GameData {
  schemaVersion: number;
  /** Như pinHash của đội: không bao giờ rời khỏi server. */
  gmPinHash: string;
  /** Tăng lên mỗi lần khôi phục về mặc định, để đá hết phiên cũ. */
  sessionEpoch: number;
  energyOpened: boolean;
  teams: Record<TeamId, Team>;
  challenges: Record<ChallengeId, ChallengeState>;
  auction: AuctionState;
  auditLog: AuditEntry[];
}

export type SyncStatus =
  | "offline"
  | "connecting"
  | "online"
  | "saving"
  | "error";

export interface Actor {
  name: string;
  role: Role | "SYSTEM";
  teamId: TeamId | null;
}

export interface BreakdownLine {
  label: string;
  value: number;
  /** Dòng tổng kết, hiển thị khác các dòng cộng/trừ. */
  total?: boolean;
}

export interface Projection {
  projectedEnergy: number;
  breakdown: BreakdownLine[];
  /** Booster có bị tiêu thụ sau khi khóa kết quả hay không. */
  boosterConsumed: boolean;
  boosterEffectLabel: string | null;
}
