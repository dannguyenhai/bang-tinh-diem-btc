import {
  BOOSTER_IDS,
  CHALLENGES,
  CHALLENGE_IDS,
  FALLBACK_FLOOR_PRICE,
  MIN_BID_INCREMENT,
  TEAM_IDS,
} from "./config";
import {
  computeProjection,
  getAuctionFund,
  getMaxInvestment,
  validateInvestment,
  validateSealedBids,
} from "./engine";
import {
  createAuctionState,
  createChallengeState,
  createLot,
} from "./initialState";
import type {
  Actor,
  AuditEntry,
  BoosterId,
  ChallengeId,
  GameData,
  MatchResult,
  SealedBids,
  TeamId,
} from "./types";

export class GameError extends Error {}

function fail(message: string): never {
  throw new GameError(message);
}

let auditCounter = 0;

function newId(): string {
  auditCounter += 1;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `audit-${Date.now()}-${auditCounter}`;
}

export function addAudit(
  data: GameData,
  actor: Actor,
  entry: {
    action: string;
    teamId?: TeamId | null;
    challengeId?: ChallengeId | null;
    oldValue?: string | number | null;
    newValue?: string | number | null;
    reason?: string | null;
  },
): void {
  const record: AuditEntry = {
    id: newId(),
    timestamp: new Date().toISOString(),
    actor: actor.name,
    role: actor.role,
    teamId: entry.teamId ?? null,
    challengeId: entry.challengeId ?? null,
    action: entry.action,
    oldValue: entry.oldValue == null ? null : String(entry.oldValue),
    newValue: entry.newValue == null ? null : String(entry.newValue),
    reason: entry.reason ?? null,
  };
  data.auditLog.unshift(record);
  // Giữ log ở mức vừa phải để payload đồng bộ không phình ra.
  if (data.auditLog.length > 500) data.auditLog.length = 500;
}

const SYSTEM: Actor = { name: "SYSTEM", role: "SYSTEM", teamId: null };

/* ------------------------------------------------------------------ */
/* Thiết lập ban đầu                                                    */
/* ------------------------------------------------------------------ */

export function setTeamProfile(
  data: GameData,
  actor: Actor,
  teamId: TeamId,
  patch: { name?: string; pinHash?: string },
): void {
  const team = data.teams[teamId];
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) fail("Tên đội không được để trống.");
    addAudit(data, actor, {
      action: "Đổi tên đội",
      teamId,
      oldValue: team.name,
      newValue: name,
    });
    team.name = name;
  }
  if (patch.pinHash !== undefined) {
    team.pinHash = patch.pinHash;
    addAudit(data, actor, { action: "Đổi PIN đội", teamId });
  }
}

export function openEnergy(
  data: GameData,
  actor: Actor,
  energies: Record<TeamId, number>,
): void {
  for (const teamId of TEAM_IDS) {
    const value = energies[teamId];
    if (!Number.isInteger(value) || value < 0) {
      fail("Energy khởi đầu phải là số nguyên không âm.");
    }
  }
  for (const teamId of TEAM_IDS) {
    const team = data.teams[teamId];
    addAudit(data, actor, {
      action: "Mở nguồn Energy",
      teamId,
      oldValue: team.currentEnergy,
      newValue: energies[teamId],
    });
    team.currentEnergy = energies[teamId];
    team.publishedEnergy = energies[teamId];
  }
  data.energyOpened = true;
}

/* ------------------------------------------------------------------ */
/* Vòng đời thử thách                                                   */
/* ------------------------------------------------------------------ */

export function openChallenge(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const config = CHALLENGES[challengeId];
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "IDLE") fail("Thử thách này đã được mở.");
  if (!data.energyOpened) fail("Cần mở nguồn Energy trước khi bắt đầu.");

  for (const teamId of TEAM_IDS) {
    const team = data.teams[teamId];
    const entry = challenge.entries[teamId];
    entry.energyBefore = team.currentEnergy;
    entry.maxInvestment = config.investmentEnabled
      ? getMaxInvestment(team.currentEnergy)
      : 0;
    entry.investment = config.investmentEnabled ? null : 0;
    entry.investmentSubmitted = !config.investmentEnabled;
  }

  challenge.status = config.investmentEnabled
    ? "OPEN_FOR_INVESTMENT"
    : "PRE_GAME_LOCKED";

  addAudit(data, actor, {
    action: `Mở ${config.shortName}`,
    challengeId,
    newValue: challenge.status,
  });
}

export function submitInvestment(
  data: GameData,
  actor: Actor,
  teamId: TeamId,
  challengeId: ChallengeId,
  investment: number,
  preBoosterActivation: boolean,
): void {
  const config = CHALLENGES[challengeId];
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "OPEN_FOR_INVESTMENT") {
    fail("Vòng đầu tư đã đóng, không sửa được nữa.");
  }
  if (!config.investmentEnabled) fail("Thử thách này không có đầu tư.");

  const entry = challenge.entries[teamId];
  const energyBefore = entry.energyBefore ?? data.teams[teamId].currentEnergy;
  const check = validateInvestment(investment, energyBefore);
  if (!check.ok) fail(check.message ?? "Investment không hợp lệ.");

  const team = data.teams[teamId];
  const canPreActivate =
    config.boosterEnabled &&
    !team.boosterUsed &&
    (team.boosterOwned === "ALPHA" || team.boosterOwned === "GAMMA");
  const preActive = canPreActivate ? preBoosterActivation : false;

  const oldValue = entry.investment;
  entry.investment = investment;
  entry.preBoosterActivation = preActive;
  entry.investmentSubmitted = true;

  addAudit(data, actor, {
    action: "Gửi Investment",
    teamId,
    challengeId,
    oldValue,
    newValue: preActive
      ? `${investment} + kích hoạt ${team.boosterOwned}`
      : investment,
  });
}

export function lockInvestment(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "OPEN_FOR_INVESTMENT") {
    fail("Chỉ khóa được khi vòng đầu tư đang mở.");
  }
  const missing = TEAM_IDS.filter(
    (id) => !challenge.entries[id].investmentSubmitted,
  );
  if (missing.length > 0) {
    fail(
      `Còn ${missing.length} đội chưa gửi Investment: ${missing
        .map((id) => data.teams[id].name)
        .join(", ")}.`,
    );
  }
  challenge.status = "PRE_GAME_LOCKED";
  addAudit(data, actor, {
    action: "KHÓA INVESTMENT & PRE-ACTIVE BOOSTER",
    challengeId,
  });
}

export function startResultEntry(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "PRE_GAME_LOCKED") {
    fail("Chỉ chuyển sang nhập kết quả sau khi đã khóa vòng đầu tư.");
  }
  challenge.status = "RESULT_ENTRY";
  addAudit(data, actor, { action: "Mở nhập kết quả", challengeId });
}

export function setResult(
  data: GameData,
  actor: Actor,
  teamId: TeamId,
  challengeId: ChallengeId,
  result: MatchResult,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "RESULT_ENTRY" && challenge.status !== "GM_REVIEW") {
    fail("Không ở giai đoạn nhập kết quả.");
  }
  const entry = challenge.entries[teamId];
  const oldValue = entry.result;
  entry.result = result;
  if (result === "WIN") entry.reactiveBoosterActivation = null;
  addAudit(data, actor, {
    action: "Nhập kết quả",
    teamId,
    challengeId,
    oldValue,
    newValue: result,
  });
}

/** Các đội thua và đang giữ Beta/Delta còn dùng được. */
export function getBoosterResponseTeams(
  data: GameData,
  challengeId: ChallengeId,
): TeamId[] {
  const config = CHALLENGES[challengeId];
  if (!config.boosterEnabled) return [];
  const challenge = data.challenges[challengeId];
  return TEAM_IDS.filter((teamId) => {
    const team = data.teams[teamId];
    const entry = challenge.entries[teamId];
    if (entry.result !== "LOSE") return false;
    if (team.boosterUsed) return false;
    return team.boosterOwned === "BETA" || team.boosterOwned === "DELTA";
  });
}

export function openBoosterResponse(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "RESULT_ENTRY") {
    fail("Chỉ mở Booster Response sau khi đã nhập kết quả.");
  }
  if (TEAM_IDS.some((id) => challenge.entries[id].result === null)) {
    fail("Cần nhập WIN/LOSE cho đủ 4 đội trước.");
  }
  challenge.status = "BOOSTER_RESPONSE";
  addAudit(data, actor, { action: "MỞ BOOSTER RESPONSE", challengeId });
}

export function setReactiveBooster(
  data: GameData,
  actor: Actor,
  teamId: TeamId,
  challengeId: ChallengeId,
  use: boolean,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "BOOSTER_RESPONSE") {
    fail("Booster Response chưa mở hoặc đã đóng.");
  }
  if (!getBoosterResponseTeams(data, challengeId).includes(teamId)) {
    fail("Đội này không đủ điều kiện dùng Booster ở lượt này.");
  }
  challenge.entries[teamId].reactiveBoosterActivation = use;
  addAudit(data, actor, {
    action: use ? "Dùng Booster sau khi thua" : "Giữ Booster",
    teamId,
    challengeId,
    newValue: data.teams[teamId].boosterOwned,
  });
}

export function closeBoosterResponse(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "BOOSTER_RESPONSE") {
    fail("Booster Response không ở trạng thái mở.");
  }
  for (const teamId of getBoosterResponseTeams(data, challengeId)) {
    const entry = challenge.entries[teamId];
    if (entry.reactiveBoosterActivation === null) {
      entry.reactiveBoosterActivation = false;
    }
  }
  challenge.status = "GM_REVIEW";
  addAudit(data, actor, { action: "ĐÓNG BOOSTER RESPONSE", challengeId });
}

export function goToReview(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "RESULT_ENTRY") {
    fail("Chỉ chuyển sang soát kết quả từ bước nhập kết quả.");
  }
  if (TEAM_IDS.some((id) => challenge.entries[id].result === null)) {
    fail("Cần nhập WIN/LOSE cho đủ 4 đội trước.");
  }
  challenge.status = "GM_REVIEW";
  addAudit(data, actor, { action: "Chuyển sang soát kết quả", challengeId });
}

export function projectEntry(
  data: GameData,
  challengeId: ChallengeId,
  teamId: TeamId,
) {
  const challenge = data.challenges[challengeId];
  const entry = challenge.entries[teamId];
  const team = data.teams[teamId];
  if (entry.result === null) return null;
  // Booster đã tiêu ở chính vòng này vẫn phải hiện trong breakdown khi xem lại.
  const boosterOwned =
    !team.boosterUsed || team.boosterActivatedAtChallenge === challengeId
      ? team.boosterOwned
      : null;
  return computeProjection({
    challengeId,
    energyBefore: entry.energyBefore ?? team.currentEnergy,
    investment: entry.investment ?? 0,
    result: entry.result,
    boosterOwned,
    preBoosterActivation: entry.preBoosterActivation,
    reactiveBoosterActivation: entry.reactiveBoosterActivation === true,
  });
}

export function lockResult(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
): void {
  const challenge = data.challenges[challengeId];
  if (challenge.status !== "GM_REVIEW" && challenge.status !== "RESULT_ENTRY") {
    fail("Chưa thể khóa kết quả ở trạng thái hiện tại.");
  }
  if (TEAM_IDS.some((id) => challenge.entries[id].result === null)) {
    fail("Cần nhập WIN/LOSE cho đủ 4 đội trước khi khóa.");
  }

  for (const teamId of TEAM_IDS) {
    const entry = challenge.entries[teamId];
    const team = data.teams[teamId];
    const projection = projectEntry(data, challengeId, teamId);
    if (!projection) continue;

    const before = team.currentEnergy;
    entry.projectedEnergy = projection.projectedEnergy;
    entry.energyAfter = projection.projectedEnergy;
    team.currentEnergy = projection.projectedEnergy;

    if (projection.boosterConsumed && !team.boosterUsed) {
      team.boosterUsed = true;
      team.boosterActivatedAtChallenge = challengeId;
    }

    addAudit(data, SYSTEM, {
      action: "Chốt Energy",
      teamId,
      challengeId,
      oldValue: before,
      newValue: projection.projectedEnergy,
      reason: projection.boosterEffectLabel,
    });
  }

  challenge.status = "RESULT_LOCKED";
  addAudit(data, actor, { action: "KHÓA KẾT QUẢ", challengeId });
}

export function canReopen(data: GameData, challengeId: ChallengeId): boolean {
  if (data.challenges[challengeId].status !== "RESULT_LOCKED") return false;
  // Không cho mở lại vòng cũ khi vòng sau đã chốt điểm.
  return !CHALLENGE_IDS.some(
    (id) =>
      id > challengeId &&
      ["RESULT_LOCKED", "PUBLISHED"].includes(data.challenges[id].status),
  );
}

export function reopenResult(
  data: GameData,
  actor: Actor,
  challengeId: ChallengeId,
  reason: string,
): void {
  if (!reason.trim()) fail("Bắt buộc nhập lý do mở lại kết quả.");
  if (!canReopen(data, challengeId)) {
    fail("Không mở lại được vòng này vì vòng sau đã chốt điểm.");
  }

  const challenge = data.challenges[challengeId];
  for (const teamId of TEAM_IDS) {
    const entry = challenge.entries[teamId];
    const team = data.teams[teamId];
    if (entry.energyBefore !== null) team.currentEnergy = entry.energyBefore;
    if (team.boosterActivatedAtChallenge === challengeId) {
      team.boosterUsed = false;
      team.boosterActivatedAtChallenge = null;
    }
    entry.projectedEnergy = null;
    entry.energyAfter = null;
  }

  challenge.status = "RESULT_ENTRY";
  addAudit(data, actor, {
    action: "MỞ LẠI KẾT QUẢ",
    challengeId,
    reason: reason.trim(),
  });
}

export function publishScoreboard(data: GameData, actor: Actor): void {
  for (const teamId of TEAM_IDS) {
    const team = data.teams[teamId];
    if (team.publishedEnergy !== team.currentEnergy) {
      addAudit(data, actor, {
        action: "Công bố Scoreboard",
        teamId,
        oldValue: team.publishedEnergy,
        newValue: team.currentEnergy,
      });
    }
    team.publishedEnergy = team.currentEnergy;
  }
  for (const id of CHALLENGE_IDS) {
    if (data.challenges[id].status === "RESULT_LOCKED") {
      data.challenges[id].status = "PUBLISHED";
    }
  }
}

/* ------------------------------------------------------------------ */
/* Đấu giá Booster                                                      */
/* ------------------------------------------------------------------ */

export function openSealedAuction(data: GameData, actor: Actor): void {
  if (data.auction.phase !== "IDLE") fail("Đấu giá đã được mở.");
  const tt2 = data.challenges[2].status;
  if (tt2 !== "RESULT_LOCKED" && tt2 !== "PUBLISHED") {
    fail("Cần khóa kết quả TT2 trước khi chốt snapshot đấu giá.");
  }

  for (const teamId of TEAM_IDS) {
    const snapshot = data.teams[teamId].currentEnergy;
    const fund = getAuctionFund(snapshot);
    data.auction.teams[teamId] = {
      energySnapshot: snapshot,
      auctionFund: fund,
      auctionReservedEnergy: snapshot - fund,
      bids: { ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 0 },
      submitted: false,
    };
    addAudit(data, SYSTEM, {
      action: "Snapshot quỹ đấu giá",
      teamId,
      oldValue: snapshot,
      newValue: fund,
    });
  }

  data.auction.phase = "SEALED_OPEN";
  addAudit(data, actor, { action: "MỞ VÒNG ĐẤU GIÁ KÍN" });
}

export function submitSealedBids(
  data: GameData,
  actor: Actor,
  teamId: TeamId,
  bids: SealedBids,
): void {
  if (data.auction.phase !== "SEALED_OPEN") fail("Vòng đấu kín đã đóng.");
  const state = data.auction.teams[teamId];
  if (state.submitted) fail("Đội đã gửi phiếu, không sửa được nữa.");

  const check = validateSealedBids(bids, state.auctionFund);
  if (!check.ok) fail(check.message ?? "Phiếu đấu giá không hợp lệ.");

  state.bids = { ...bids };
  state.submitted = true;
  addAudit(data, actor, {
    action: "Gửi phiếu đấu giá kín",
    teamId,
    newValue: BOOSTER_IDS.map((b) => `${b}:${bids[b]}`).join(" / "),
  });
}

export function lockSealedAuction(data: GameData, actor: Actor): void {
  if (data.auction.phase !== "SEALED_OPEN") fail("Không ở vòng đấu kín.");
  const missing = TEAM_IDS.filter((id) => !data.auction.teams[id].submitted);
  if (missing.length > 0) {
    fail(
      `Còn ${missing.length} đội chưa gửi phiếu: ${missing
        .map((id) => data.teams[id].name)
        .join(", ")}.`,
    );
  }
  data.auction.phase = "SEALED_LOCKED";
  addAudit(data, actor, { action: "KHÓA PHIẾU ĐẤU GIÁ KÍN" });
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Tổng số điểm cả 4 đội đặt vào một Booster — thước đo mức quan tâm. */
export function getBoosterDemand(data: GameData, booster: BoosterId): number {
  return TEAM_IDS.reduce(
    (sum, teamId) => sum + data.auction.teams[teamId].bids[booster],
    0,
  );
}

/**
 * Booster được đặt nhiều điểm nhất lên sàn trước — vòng đấu mở màn bằng
 * món nóng nhất. Hòa tổng thì xáo trộn trước khi sắp, để thứ tự khai báo
 * trong code không thành lợi thế ngầm.
 */
export function orderAuctionLots(data: GameData, actor: Actor): void {
  if (data.auction.phase !== "SEALED_LOCKED") {
    fail("Chỉ xếp thứ tự sau khi đã khóa phiếu kín.");
  }
  data.auction.order = shuffle(BOOSTER_IDS).sort(
    (a, b) => getBoosterDemand(data, b) - getBoosterDemand(data, a),
  );
  data.auction.currentLotIndex = 0;
  data.auction.phase = "RUNNING";
  addAudit(data, actor, {
    action: "XẾP THỨ TỰ BOOSTER THEO MỨC QUAN TÂM",
    newValue: data.auction.order
      .map((b) => `${b} (${getBoosterDemand(data, b)})`)
      .join(" → "),
  });
  prepareCurrentLot(data);
}

/** Xác định ứng viên cho lô hiện tại: top 2 giá kín > 0 trong nhóm chưa có Booster. */
export function prepareCurrentLot(data: GameData): void {
  const auction = data.auction;
  if (auction.phase !== "RUNNING") return;
  const booster = auction.order[auction.currentLotIndex];
  if (!booster) {
    finishAuctionOrder(data);
    return;
  }
  const lot = auction.lots[booster];
  // Lô đã xong (thường gặp sau khi thu hồi và quay lại giữa chừng) — đi tiếp.
  if (lot.status === "AWARDED" || lot.status === "SKIPPED") {
    advanceLot(data);
    return;
  }
  if (lot.status !== "PENDING") return;

  const eligible = TEAM_IDS.filter(
    (id) => !data.teams[id].boosterOwned && auction.teams[id].bids[booster] > 0,
  ).sort((a, b) => auction.teams[b].bids[booster] - auction.teams[a].bids[booster]);

  if (eligible.length === 0) {
    lot.status = "SKIPPED";
    lot.note = "Không đội nào đặt giá > 0 — chuyển xuống vòng phân bổ.";
    addAudit(data, SYSTEM, {
      action: `Booster ${booster}: SKIPPED`,
      newValue: lot.note,
    });
    advanceLot(data);
    return;
  }

  if (eligible.length === 1) {
    const teamId = eligible[0];
    lot.status = "PUBLIC";
    lot.candidates = [teamId];
    lot.currentBid = auction.teams[teamId].bids[booster];
    lot.currentLeader = teamId;
    lot.note = "Chỉ một đội đặt giá — thắng ngay, không cần đấu công khai.";
    return;
  }

  const secondBid = auction.teams[eligible[1]].bids[booster];
  const auto = eligible.filter((id) => auction.teams[id].bids[booster] > secondBid);
  const tied = eligible.filter(
    (id) => auction.teams[id].bids[booster] === secondBid,
  );
  const slots = 2 - auto.length;

  if (tied.length <= slots) {
    lot.candidates = [...auto, ...tied].slice(0, 2);
    lot.status = "PUBLIC";
  } else {
    lot.candidates = auto;
    lot.tieCandidates = tied;
    lot.tieSlots = slots;
    lot.status = "TIE_BREAK";
    lot.note = "Hòa giá kín — GM bốc thăm ngoài sân khấu rồi chọn đội vào vòng công khai.";
    return;
  }

  initPublicRound(data, booster);
}

function initPublicRound(data: GameData, booster: BoosterId): void {
  const auction = data.auction;
  const lot = auction.lots[booster];
  const bids = lot.candidates.map((id) => auction.teams[id].bids[booster]);
  const top = Math.max(...bids);
  const leaders = lot.candidates.filter(
    (id) => auction.teams[id].bids[booster] === top,
  );
  lot.currentBid = top;
  lot.currentLeader = leaders.length === 1 ? leaders[0] : null;
  lot.note =
    leaders.length === 1
      ? null
      : "Hai đội bằng giá kín — cả hai phải nâng giá để giành quyền dẫn.";
}

export function resolveTie(
  data: GameData,
  actor: Actor,
  booster: BoosterId,
  teamId: TeamId,
): void {
  const lot = data.auction.lots[booster];
  if (lot.status !== "TIE_BREAK") fail("Lô này không ở trạng thái xử lý hòa.");
  if (!lot.tieCandidates.includes(teamId)) fail("Đội này không nằm trong nhóm hòa.");

  lot.candidates.push(teamId);
  lot.tieCandidates = lot.tieCandidates.filter((id) => id !== teamId);
  lot.tieSlots -= 1;

  addAudit(data, actor, {
    action: `Xử lý hòa giá kín — Booster ${booster}`,
    teamId,
    newValue: data.teams[teamId].name,
    reason: "GM bốc thăm ngoài sân khấu",
  });

  if (lot.tieSlots <= 0) {
    lot.status = "PUBLIC";
    lot.tieCandidates = [];
    initPublicRound(data, booster);
  }
}

/** Hệ thống tự bốc thăm chọn đủ số suất còn lại trong nhóm hòa giá kín. */
export function resolveTieRandom(
  data: GameData,
  actor: Actor,
  booster: BoosterId,
): void {
  const lot = data.auction.lots[booster];
  if (lot.status !== "TIE_BREAK") fail("Lô này không ở trạng thái xử lý hòa.");

  const picked = shuffle(lot.tieCandidates).slice(0, lot.tieSlots);
  for (const teamId of picked) lot.candidates.push(teamId);

  addAudit(data, actor, {
    action: `Bốc thăm ngẫu nhiên — Booster ${booster}`,
    newValue: picked.map((id) => data.teams[id].name).join(", "),
    reason: `Hòa giá kín ${lot.tieCandidates
      .map((id) => data.teams[id].name)
      .join(" / ")} — hệ thống bốc thăm`,
  });

  lot.tieCandidates = [];
  lot.tieSlots = 0;
  lot.status = "PUBLIC";
  initPublicRound(data, booster);
}

/**
 * Trao lô khi hai đội bằng giá và không ai nâng thêm được — hệ thống bốc thăm
 * thay vì bắt GM quay số ngoài sân khấu.
 */
export function awardLotRandom(
  data: GameData,
  actor: Actor,
  booster: BoosterId,
): void {
  const lot = data.auction.lots[booster];
  if (lot.status !== "PUBLIC") fail("Lô này chưa sẵn sàng để trao.");
  if (lot.candidates.length === 0) fail("Lô này không có đội nào tranh.");

  const winner = lot.currentLeader ?? shuffle(lot.candidates)[0];
  if (!lot.currentLeader) {
    addAudit(data, actor, {
      action: `Bốc thăm ngẫu nhiên chọn đội thắng — Booster ${booster}`,
      teamId: winner,
      newValue: data.teams[winner].name,
      reason: `Hai đội bằng giá ${lot.currentBid}, không ai nâng thêm`,
    });
  }
  awardLot(data, actor, booster, winner);
}

export function getMinNextBid(data: GameData, booster: BoosterId): number {
  return data.auction.lots[booster].currentBid + MIN_BID_INCREMENT;
}

export function placePublicBid(
  data: GameData,
  actor: Actor,
  booster: BoosterId,
  teamId: TeamId,
  amount: number,
): void {
  const lot = data.auction.lots[booster];
  if (lot.status !== "PUBLIC") fail("Lô này không đang đấu công khai.");
  if (!lot.candidates.includes(teamId)) fail("Đội này không ở trong vòng đấu.");
  if (lot.currentLeader === teamId) fail("Đội đang dẫn giá, chờ đội kia trả lời.");
  if (!Number.isInteger(amount)) fail("Giá phải là số nguyên.");

  const minBid = getMinNextBid(data, booster);
  if (amount < minBid) fail(`Giá tiếp theo tối thiểu là ${minBid}.`);

  const fund = data.auction.teams[teamId].auctionFund;
  if (amount > fund) fail(`Vượt quỹ đấu giá của đội (tối đa ${fund}).`);

  lot.currentBid = amount;
  lot.currentLeader = teamId;
  addAudit(data, actor, {
    action: `Nâng giá — Booster ${booster}`,
    teamId,
    newValue: amount,
  });
}

export function awardLot(
  data: GameData,
  actor: Actor,
  booster: BoosterId,
  explicitWinner?: TeamId,
): void {
  const lot = data.auction.lots[booster];
  if (lot.status !== "PUBLIC") fail("Lô này chưa sẵn sàng để trao.");
  const winner = explicitWinner ?? lot.currentLeader;
  if (!winner) fail("Chưa có đội dẫn giá — GM cần bốc thăm và chọn đội thắng.");
  if (!lot.candidates.includes(winner)) fail("Đội này không ở trong vòng đấu.");

  const price = getLotAwardPrice(data, booster, winner);
  const team = data.teams[winner];
  const before = team.currentEnergy;

  team.boosterOwned = booster;
  team.currentEnergy = Math.max(0, team.currentEnergy - price);
  lot.status = "AWARDED";
  lot.winner = winner;
  lot.winningPrice = price;

  addAudit(data, actor, {
    action: `TRAO BOOSTER ${booster}`,
    teamId: winner,
    oldValue: before,
    newValue: `${team.currentEnergy} (trả ${price})`,
  });

  advanceLot(data);
}

/**
 * Thu hồi một lô đã trao — dùng khi GM bấm nhầm giữa buổi. Hoàn Energy, trả
 * Booster về kho và mở lại chính lô đó để đấu tiếp từ đầu.
 */
export function revokeAward(
  data: GameData,
  actor: Actor,
  booster: BoosterId,
  reason: string,
): void {
  if (!reason.trim()) fail("Bắt buộc nhập lý do thu hồi.");

  const lot = data.auction.lots[booster];
  if (lot.status !== "AWARDED" || !lot.winner) {
    fail("Booster này chưa trao cho đội nào.");
  }

  const winner = lot.winner;
  const team = data.teams[winner];
  if (team.boosterUsed) {
    fail(
      `${team.name} đã dùng Booster này rồi — phải mở lại kết quả vòng đó trước.`,
    );
  }

  const price = lot.winningPrice ?? 0;
  const before = team.currentEnergy;
  team.boosterOwned = null;
  team.currentEnergy = before + price;

  data.auction.lots[booster] = createLot(booster);
  // Bốc thăm thứ tự phân bổ cũ không còn đúng khi số đội thay đổi.
  data.auction.fallbackOrder = [];

  addAudit(data, actor, {
    action: `THU HỒI BOOSTER ${booster}`,
    teamId: winner,
    oldValue: `${before} (đã trả ${price})`,
    newValue: team.currentEnergy,
    reason: reason.trim(),
  });

  const index = data.auction.order.indexOf(booster);
  if (index >= 0) {
    data.auction.phase = "RUNNING";
    data.auction.currentLotIndex = index;
    prepareCurrentLot(data);
  } else {
    // Chưa từng lên sàn (được trao ở vòng phân bổ) — quay lại vòng phân bổ.
    data.auction.phase = "FALLBACK";
  }
}

export function skipLot(data: GameData, actor: Actor, booster: BoosterId): void {
  const lot = data.auction.lots[booster];
  if (lot.status === "AWARDED") fail("Lô này đã có chủ.");
  lot.status = "SKIPPED";
  lot.note = lot.note ?? "GM bỏ qua — chuyển xuống vòng phân bổ.";
  addAudit(data, actor, { action: `Bỏ qua Booster ${booster}` });
  advanceLot(data);
}

export function advanceLot(data: GameData): void {
  const auction = data.auction;
  auction.currentLotIndex += 1;
  if (auction.currentLotIndex >= auction.order.length) {
    finishAuctionOrder(data);
    return;
  }
  prepareCurrentLot(data);
}

export function getUnassignedTeams(data: GameData): TeamId[] {
  return TEAM_IDS.filter((id) => !data.teams[id].boosterOwned);
}

export function getUnassignedBoosters(data: GameData): BoosterId[] {
  return BOOSTER_IDS.filter((b) => data.auction.lots[b].status !== "AWARDED");
}

function finishAuctionOrder(data: GameData): void {
  const teamsLeft = getUnassignedTeams(data);
  const boostersLeft = getUnassignedBoosters(data);
  if (teamsLeft.length > 0 && boostersLeft.length > 0) {
    data.auction.phase = "FALLBACK";
    addAudit(data, SYSTEM, {
      action: "Chuyển sang phân bổ Booster còn lại",
      newValue: `${teamsLeft.length} đội / ${boostersLeft.length} booster`,
    });
  } else {
    data.auction.phase = "DONE";
    addAudit(data, SYSTEM, { action: "HOÀN TẤT ĐẤU GIÁ" });
  }
}

export function randomizeFallbackOrder(data: GameData, actor: Actor): void {
  if (data.auction.phase !== "FALLBACK") fail("Không ở vòng phân bổ.");
  data.auction.fallbackOrder = shuffle(getUnassignedTeams(data));
  addAudit(data, actor, {
    action: "BỐC THĂM THỨ TỰ CHỌN BOOSTER",
    newValue: data.auction.fallbackOrder
      .map((id) => data.teams[id].name)
      .join(" → "),
  });
}

/**
 * Chỉ còn đúng một đội chưa có Booster. Món họ nhận là món cuối của cả
 * phiên, không còn ai tranh — dù đến qua đấu giá hay qua phân bổ.
 */
export function isFinalTeamRemaining(data: GameData): boolean {
  return getUnassignedTeams(data).length === 1;
}

/** Giá món cuối: nửa quỹ đấu giá của chính đội đó. */
export function getFinalBoosterPrice(data: GameData, teamId: TeamId): number {
  return Math.floor(data.auction.teams[teamId].auctionFund * 0.5);
}

export function getFallbackPrice(
  data: GameData,
  teamId: TeamId,
  booster: BoosterId,
): number {
  const fund = data.auction.teams[teamId].auctionFund;
  if (fund === 0) return 0;
  if (isFinalTeamRemaining(data)) return getFinalBoosterPrice(data, teamId);
  const sealed = data.auction.teams[teamId].bids[booster];
  return Math.min(fund, Math.max(sealed, FALLBACK_FLOOR_PRICE));
}

/**
 * Giá đội thắng phải trả cho một lô đấu giá. Dùng chung cho cả mutation lẫn
 * giao diện, để con số GM nhìn thấy đúng bằng con số bị trừ.
 */
export function getLotAwardPrice(
  data: GameData,
  booster: BoosterId,
  winner: TeamId,
): number {
  if (isFinalTeamRemaining(data)) return getFinalBoosterPrice(data, winner);
  const lot = data.auction.lots[booster];
  // Chưa ai nâng giá công khai thì trả đúng giá kín của mình.
  return lot.currentLeader === null
    ? data.auction.teams[winner].bids[booster]
    : lot.currentBid;
}

export function assignFallbackBooster(
  data: GameData,
  actor: Actor,
  teamId: TeamId,
  booster: BoosterId,
): void {
  if (data.auction.phase !== "FALLBACK") fail("Không ở vòng phân bổ.");
  if (data.teams[teamId].boosterOwned) fail("Đội này đã có Booster.");
  if (!getUnassignedBoosters(data).includes(booster)) {
    fail("Booster này đã có chủ.");
  }
  const nextInLine = data.auction.fallbackOrder.find(
    (id) => !data.teams[id].boosterOwned,
  );
  if (nextInLine && nextInLine !== teamId) {
    fail(`Đến lượt ${data.teams[nextInLine].name} chọn trước.`);
  }

  const price = getFallbackPrice(data, teamId, booster);
  const team = data.teams[teamId];
  const before = team.currentEnergy;

  team.boosterOwned = booster;
  team.currentEnergy = Math.max(0, team.currentEnergy - price);

  const lot = data.auction.lots[booster];
  lot.status = "AWARDED";
  lot.winner = teamId;
  lot.winningPrice = price;
  lot.note = "Phân bổ sau đấu giá";

  addAudit(data, actor, {
    action: `PHÂN BỔ BOOSTER ${booster}`,
    teamId,
    oldValue: before,
    newValue: `${team.currentEnergy} (trả ${price})`,
  });

  if (getUnassignedTeams(data).length === 0 || getUnassignedBoosters(data).length === 0) {
    data.auction.phase = "DONE";
    addAudit(data, SYSTEM, { action: "HOÀN TẤT ĐẤU GIÁ" });
  }
}

export function closeAuction(data: GameData, actor: Actor): void {
  data.auction.phase = "DONE";
  addAudit(data, actor, { action: "Kết thúc đấu giá thủ công" });
}

/* ------------------------------------------------------------------ */
/* Tiện ích                                                             */
/* ------------------------------------------------------------------ */

export function resetGame(data: GameData, actor: Actor, startEnergy: number): void {
  for (const teamId of TEAM_IDS) {
    const team = data.teams[teamId];
    team.currentEnergy = startEnergy;
    team.publishedEnergy = startEnergy;
    team.boosterOwned = null;
    team.boosterUsed = false;
    team.boosterActivatedAtChallenge = null;
  }
  for (const id of CHALLENGE_IDS) {
    data.challenges[id] = createChallengeState(id);
  }
  data.auction = createAuctionState();
  data.energyOpened = false;
  data.auditLog = [];
  addAudit(data, actor, {
    action: "RESET TOÀN BỘ VÁN CHƠI",
    newValue: `Energy khởi đầu ${startEnergy}`,
  });
}
