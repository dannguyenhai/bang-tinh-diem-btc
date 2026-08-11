import { CHALLENGES } from "./config";
import type {
  BoosterId,
  ChallengeId,
  MatchResult,
  Projection,
} from "./types";

/**
 * Trần đầu tư của một đội: 30% Energy hiện có, tối thiểu 1 nếu còn Energy.
 */
export function getMaxInvestment(currentEnergy: number): number {
  if (currentEnergy <= 0) return 0;
  return Math.max(1, Math.floor(currentEnergy * 0.3));
}

export interface InvestmentValidation {
  ok: boolean;
  message: string | null;
}

export function validateInvestment(
  investment: number,
  currentEnergy: number,
): InvestmentValidation {
  const max = getMaxInvestment(currentEnergy);
  if (currentEnergy <= 0) {
    return investment === 0
      ? { ok: true, message: null }
      : { ok: false, message: "Energy đang bằng 0, chỉ được nhập 0." };
  }
  if (!Number.isInteger(investment)) {
    return { ok: false, message: "Investment phải là số nguyên." };
  }
  if (investment < 1) {
    return { ok: false, message: "Investment tối thiểu là 1." };
  }
  if (investment > max) {
    return { ok: false, message: `Investment tối đa là ${max}.` };
  }
  return { ok: true, message: null };
}

export function getAlphaBonus(baseReward: number): number {
  return Math.min(baseReward, 40);
}

export function getGammaBonus(baseReward: number): number {
  return Math.floor(baseReward * 0.5);
}

export function getShieldProtection(investment: number): number {
  return Math.min(investment, 25);
}

export function getDeltaRefund(investment: number): number {
  return Math.min(Math.floor(investment * 0.5), 20);
}

/**
 * Delta chỉ mở khi Energy còn lại sau khi trừ Investment không quá 80.
 * Điều kiện luôn phải kiểm tra TRƯỚC khi cộng refund.
 */
export function canUseDelta(currentEnergy: number, investment: number): boolean {
  return currentEnergy - investment <= 80;
}

export interface ProjectionInput {
  challengeId: ChallengeId;
  energyBefore: number;
  investment: number;
  result: MatchResult;
  boosterOwned: BoosterId | null;
  /** Alpha/Gamma đã chốt kích hoạt trước giờ thi đấu. */
  preBoosterActivation: boolean;
  /** Beta/Delta đội chọn dùng sau khi thua. */
  reactiveBoosterActivation: boolean;
}

/**
 * Tính Energy dự kiến cùng bảng breakdown để GM soát lại bằng mắt.
 * Hàm thuần — không đụng vào state, dùng được cả ở màn preview lẫn lúc khóa kết quả.
 */
export function computeProjection(input: ProjectionInput): Projection {
  const config = CHALLENGES[input.challengeId];
  const { baseReward, investmentEnabled, boosterEnabled } = config;
  const energyBefore = input.energyBefore;
  const investment = investmentEnabled ? input.investment : 0;

  const breakdown: Projection["breakdown"] = [
    { label: "Energy hiện tại", value: energyBefore },
  ];

  const booster = boosterEnabled ? input.boosterOwned : null;
  const preActive =
    input.preBoosterActivation &&
    (booster === "ALPHA" || booster === "GAMMA");
  const reactiveActive =
    input.reactiveBoosterActivation &&
    (booster === "BETA" || booster === "DELTA");

  let projected: number;
  let boosterConsumed = false;
  let boosterEffectLabel: string | null = null;

  if (input.result === "WIN") {
    projected = energyBefore + baseReward;
    breakdown.push({ label: "Reward", value: baseReward });

    if (investmentEnabled) {
      projected += investment;
      breakdown.push({ label: "Investment hoàn lại", value: investment });
    }

    if (preActive && booster === "ALPHA") {
      const bonus = getAlphaBonus(baseReward);
      projected += bonus;
      breakdown.push({ label: "ALPHA — AI Booster", value: bonus });
      boosterConsumed = true;
      boosterEffectLabel = `ALPHA +${bonus}`;
    }

    if (preActive && booster === "GAMMA") {
      const bonus = getGammaBonus(baseReward);
      projected += bonus;
      breakdown.push({ label: "GAMMA — Overdrive", value: bonus });
      boosterConsumed = true;
      boosterEffectLabel = `GAMMA +${bonus}`;
    }
  } else {
    // LOSE
    if (!investmentEnabled) {
      // TT3 thua thì giữ nguyên Energy.
      projected = energyBefore;
    } else {
      projected = energyBefore - investment;
      breakdown.push({ label: "Investment mất", value: -investment });

      if (preActive && booster === "ALPHA") {
        projected -= 10;
        breakdown.push({ label: "ALPHA — phạt khi thua", value: -10 });
        boosterConsumed = true;
        boosterEffectLabel = "ALPHA -10";
        if (projected < 0) {
          breakdown.push({ label: "Chặn sàn 0", value: -projected });
          projected = 0;
        }
      }

      if (preActive && booster === "GAMMA") {
        // Gamma thua không phạt thêm, nhưng booster vẫn coi như đã dùng.
        boosterConsumed = true;
        boosterEffectLabel = "GAMMA — đã dùng, không hiệu lực";
      }

      if (reactiveActive && booster === "BETA") {
        const shield = getShieldProtection(investment);
        projected += shield;
        breakdown.push({ label: "BETA — Shield che chắn", value: shield });
        boosterConsumed = true;
        boosterEffectLabel = `BETA +${shield}`;
      }

      if (reactiveActive && booster === "DELTA") {
        const refund = getDeltaRefund(investment);
        projected += refund;
        breakdown.push({ label: "DELTA — Rescue hoàn lại", value: refund });
        boosterConsumed = true;
        boosterEffectLabel = `DELTA +${refund}`;
      }
    }
  }

  projected = Math.max(0, projected);
  breakdown.push({ label: "Energy dự kiến", value: projected, total: true });

  return { projectedEnergy: projected, breakdown, boosterConsumed, boosterEffectLabel };
}

/** Quỹ đấu giá: 80% Energy tại thời điểm chốt snapshot sau TT2. */
export function getAuctionFund(energySnapshot: number): number {
  return Math.floor(Math.max(0, energySnapshot) * 0.8);
}

export function validateSealedBids(
  bids: Record<BoosterId, number>,
  auctionFund: number,
): InvestmentValidation {
  const values = Object.values(bids);
  if (values.some((v) => !Number.isInteger(v) || v < 0)) {
    return { ok: false, message: "Giá đặt phải là số nguyên không âm." };
  }
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total > auctionFund) {
    return {
      ok: false,
      message: `Tổng 4 giá (${total}) vượt quỹ đấu giá ${auctionFund}.`,
    };
  }
  if (auctionFund > 0 && total === 0) {
    return {
      ok: false,
      message: "Phải đặt giá > 0 cho ít nhất một Booster.",
    };
  }
  return { ok: true, message: null };
}
