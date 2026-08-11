import type { BoosterId, ChallengeConfig, ChallengeId, TeamId } from "./types";

export const TEAM_IDS: TeamId[] = ["TEAM_1", "TEAM_2", "TEAM_3", "TEAM_4"];

export const CHALLENGE_IDS: ChallengeId[] = [1, 2, 3, 4, 5];

export const BOOSTER_IDS: BoosterId[] = ["ALPHA", "BETA", "GAMMA", "DELTA"];

export const DEFAULT_TEAMS = [
  { id: "TEAM_1" as TeamId, name: "TEAM ALPHA", color: "#38bdf8", pin: "1111" },
  { id: "TEAM_2" as TeamId, name: "TEAM BETA", color: "#f5c542", pin: "2222" },
  { id: "TEAM_3" as TeamId, name: "TEAM GAMMA", color: "#c084fc", pin: "3333" },
  { id: "TEAM_4" as TeamId, name: "TEAM DELTA", color: "#4ade80", pin: "4444" },
];

export const GM_DEFAULT_PIN = "9999";

export const DEFAULT_START_ENERGY = 100;

export const CHALLENGES: Record<ChallengeId, ChallengeConfig> = {
  1: {
    id: 1,
    name: "THỬ THÁCH 1 — KIẾN THỨC",
    shortName: "TT1",
    baseReward: 50,
    investmentEnabled: true,
    boosterEnabled: false,
    participantType: "05 người + đầu tư Energy",
  },
  2: {
    id: 2,
    name: "THỬ THÁCH 2 — NGHỆ THUẬT",
    shortName: "TT2",
    baseReward: 60,
    investmentEnabled: true,
    boosterEnabled: false,
    participantType: "Full Team + đầu tư Energy",
  },
  3: {
    id: 3,
    name: "THỬ THÁCH 3 — PHẢN XẠ",
    shortName: "TT3",
    baseReward: 70,
    investmentEnabled: false,
    boosterEnabled: false,
    participantType: "10 người + không đầu tư",
  },
  4: {
    id: 4,
    name: "THỬ THÁCH 4 — TEAMWORK",
    shortName: "TT4",
    baseReward: 90,
    investmentEnabled: true,
    boosterEnabled: true,
    participantType: "Full Team + đầu tư + Booster",
  },
  5: {
    id: 5,
    name: "THỬ THÁCH 5 — MAY RỦI",
    shortName: "TT5",
    baseReward: 100,
    investmentEnabled: true,
    boosterEnabled: true,
    participantType: "Full Team + đầu tư cuối + Booster",
  },
};

export const BOOSTER_META: Record<
  BoosterId,
  {
    name: string;
    short: string;
    /** Màu nhận diện riêng của từng Booster trên sân khấu. */
    color: string;
    tagline: string;
    timing: "PRE" | "REACTIVE";
    description: string;
  }
> = {
  ALPHA: {
    short: "ALPHA",
    color: "#38bdf8",
    name: "ALPHA — AI BOOSTER",
    tagline: "Kích hoạt TRƯỚC thử thách",
    timing: "PRE",
    description:
      "Thắng: +40 Energy thưởng thêm. Thua: mất Investment và bị phạt thêm 10 Energy (không xuống dưới 0).",
  },
  BETA: {
    short: "BETA",
    color: "#22d3ee",
    name: "BETA — SHIELD",
    tagline: "Chỉ dùng SAU khi thua",
    timing: "REACTIVE",
    description: "Che chắn tối đa 25 Energy trong phần Investment vừa mất.",
  },
  GAMMA: {
    short: "GAMMA",
    color: "#fb923c",
    name: "GAMMA — OVERDRIVE",
    tagline: "Kích hoạt TRƯỚC thử thách",
    timing: "PRE",
    description:
      "Thắng: cộng thêm 50% Reward (TT4 +45, TT5 +50). Thua: chỉ mất Investment, không phạt thêm.",
  },
  DELTA: {
    short: "DELTA",
    color: "#f472b6",
    name: "DELTA — RESCUE",
    tagline: "Chỉ dùng SAU khi thua",
    timing: "REACTIVE",
    description:
      "Điều kiện: Energy sau khi thua ≤ 80. Hoàn lại 50% Investment, tối đa 20 Energy.",
  },
};

export const CHALLENGE_STATUS_LABEL: Record<string, string> = {
  IDLE: "CHƯA MỞ",
  OPEN_FOR_INVESTMENT: "ĐANG MỞ NHẬN ĐẦU TƯ",
  PRE_GAME_LOCKED: "ĐÃ KHÓA — ĐANG THI ĐẤU",
  RESULT_ENTRY: "GM NHẬP KẾT QUẢ",
  BOOSTER_RESPONSE: "CHỜ ĐỘI QUYẾT ĐỊNH BOOSTER",
  GM_REVIEW: "GM SOÁT LẠI",
  RESULT_LOCKED: "ĐÃ KHÓA KẾT QUẢ",
  PUBLISHED: "ĐÃ CÔNG BỐ",
};

export const AUCTION_PHASE_LABEL: Record<string, string> = {
  IDLE: "CHƯA MỞ ĐẤU GIÁ",
  SEALED_OPEN: "VÒNG 1 — ĐẤU GIÁ KÍN",
  SEALED_LOCKED: "ĐÃ KHÓA PHIẾU KÍN",
  RUNNING: "VÒNG 2 — ĐẤU GIÁ CÔNG KHAI",
  FALLBACK: "PHÂN BỔ BOOSTER CÒN LẠI",
  DONE: "HOÀN TẤT ĐẤU GIÁ",
};

/** Bước giá tối thiểu ở vòng đấu công khai. */
export const MIN_BID_INCREMENT = 5;

/** Giá sàn khi phân bổ booster không ai tranh. */
export const FALLBACK_FLOOR_PRICE = 5;
