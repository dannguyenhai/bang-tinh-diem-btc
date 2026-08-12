import { CARE_TEAM_ACTIONS, actionTeamId, type GameAction } from "@/lib/actions";
import { createInitialGameData, normalizeGameData } from "@/lib/initialState";
import { TEAM_IDS } from "@/lib/config";
import * as M from "@/lib/mutations";
import type { Actor, GameData, Session } from "@/lib/types";
import { hashPin } from "./crypto";

export class ForbiddenError extends Error {}

/** Tên người thao tác lấy từ dữ liệu gốc, không lấy từ payload client gửi lên. */
function actorOf(data: GameData, session: Session): Actor {
  if (session.role === "GM") {
    return { name: "Game Master", role: "GM", teamId: null };
  }
  const teamId = session.teamId;
  return {
    name: teamId ? data.teams[teamId].name : "Care Team",
    role: "CARE_TEAM",
    teamId,
  };
}

function authorize(action: GameAction, session: Session): void {
  if (session.role === "GM") return;

  if (!CARE_TEAM_ACTIONS.has(action.type)) {
    throw new ForbiddenError(
      "Chỉ Game Master mới thực hiện được thao tác này.",
    );
  }
  const target = actionTeamId(action);
  if (!target || target !== session.teamId) {
    throw new ForbiddenError("Không thao tác được trên dữ liệu của đội khác.");
  }
}

/**
 * Áp một hành động lên bản sao state. Ném GameError khi sai luật chơi,
 * ForbiddenError khi sai quyền — route handler dịch thành 400 / 403.
 */
export function applyAction(
  data: GameData,
  action: GameAction,
  session: Session,
): void {
  authorize(action, session);
  const actor = actorOf(data, session);

  switch (action.type) {
    case "openEnergy":
      return M.openEnergy(data, actor, action.energies);

    case "setTeamProfile": {
      if (session.role === "CARE_TEAM") {
        // Đội tự đặt tên mình được, nhưng PIN là việc của Game Master.
        if (action.pin !== undefined) {
          throw new ForbiddenError("Chỉ Game Master mới đổi được PIN.");
        }
        // Tên đã lên màn LED rồi thì không cho sửa giữa buổi.
        if (data.energyOpened) {
          throw new ForbiddenError(
            "Ván chơi đã bắt đầu — nhờ Game Master đổi tên giúp.",
          );
        }
      }
      if (action.pin !== undefined && !/^\d{4,6}$/.test(action.pin)) {
        throw new M.GameError("PIN phải gồm 4–6 chữ số.");
      }
      return M.setTeamProfile(data, actor, action.teamId, {
        name: action.name,
        // PIN được băm ngay tại đây; dạng thô không bao giờ được lưu.
        pinHash: action.pin === undefined ? undefined : hashPin(action.pin),
      });
    }

    case "setGmPin": {
      if (!/^\d{4,6}$/.test(action.pin)) {
        throw new M.GameError("PIN phải gồm 4–6 chữ số.");
      }
      data.gmPinHash = hashPin(action.pin);
      M.addAudit(data, actor, { action: "Đổi PIN Game Master" });
      return;
    }

    case "openChallenge":
      return M.openChallenge(data, actor, action.challengeId);

    case "submitInvestment":
      return M.submitInvestment(
        data,
        actor,
        action.teamId,
        action.challengeId,
        action.investment,
        action.preBoosterActivation,
      );

    case "lockInvestment":
      return M.lockInvestment(data, actor, action.challengeId);

    case "startResultEntry":
      return M.startResultEntry(data, actor, action.challengeId);

    case "setResult":
      return M.setResult(
        data,
        actor,
        action.teamId,
        action.challengeId,
        action.result,
      );

    case "openBoosterResponse":
      return M.openBoosterResponse(data, actor, action.challengeId);

    case "setReactiveBooster":
      return M.setReactiveBooster(
        data,
        actor,
        action.teamId,
        action.challengeId,
        action.use,
      );

    case "closeBoosterResponse":
      return M.closeBoosterResponse(data, actor, action.challengeId);

    case "goToReview":
      return M.goToReview(data, actor, action.challengeId);

    case "lockResult":
      return M.lockResult(data, actor, action.challengeId);

    case "reopenResult":
      return M.reopenResult(data, actor, action.challengeId, action.reason);

    case "publishScoreboard":
      return M.publishScoreboard(data, actor);

    case "openSealedAuction":
      return M.openSealedAuction(data, actor);

    case "submitSealedBids":
      return M.submitSealedBids(data, actor, action.teamId, action.bids);

    case "lockSealedAuction":
      return M.lockSealedAuction(data, actor);

    case "orderAuctionLots":
      return M.orderAuctionLots(data, actor);

    case "resolveTie":
      return M.resolveTie(data, actor, action.booster, action.teamId);

    case "resolveTieRandom":
      return M.resolveTieRandom(data, actor, action.booster);

    case "awardLotRandom":
      return M.awardLotRandom(data, actor, action.booster);

    case "placePublicBid":
      return M.placePublicBid(
        data,
        actor,
        action.booster,
        action.teamId,
        action.amount,
      );

    case "awardLot":
      return M.awardLot(data, actor, action.booster, action.winner);

    case "skipLot":
      return M.skipLot(data, actor, action.booster);

    case "revokeAward":
      return M.revokeAward(data, actor, action.booster, action.reason);

    case "randomizeFallbackOrder":
      return M.randomizeFallbackOrder(data, actor);

    case "assignFallbackBooster":
      return M.assignFallbackBooster(
        data,
        actor,
        action.teamId,
        action.booster,
      );

    case "closeAuction":
      return M.closeAuction(data, actor);

    case "resetGame":
      return M.resetGame(data, actor, action.startEnergy);

    case "factoryReset": {
      if (!Number.isInteger(action.startEnergy) || action.startEnergy < 0) {
        throw new M.GameError("Energy khởi đầu phải là số nguyên không âm.");
      }
      const fresh = createInitialGameData(action.startEnergy, hashPin);
      data.gmPinHash = fresh.gmPinHash;
      // Đá hết phiên đang đăng nhập: PIN đã về mặc định, cookie cũ không
      // được phép sống tiếp trên máy của các đội.
      data.sessionEpoch = data.sessionEpoch + 1;
      data.energyOpened = false;
      data.teams = fresh.teams;
      data.challenges = fresh.challenges;
      data.auction = fresh.auction;
      data.auditLog = [];
      M.addAudit(data, actor, {
        action: "KHÔI PHỤC TOÀN BỘ VỀ MẶC ĐỊNH",
        newValue: `Energy khởi đầu ${action.startEnergy} · tên đội và PIN về mặc định`,
      });
      return;
    }

    case "importState": {
      const incoming = normalizeGameData(action.data);
      // File sao lưu không chứa PIN (đã bị lọc lúc export) — giữ nguyên PIN hiện tại.
      const gmPinHash = data.gmPinHash;
      const sessionEpoch = data.sessionEpoch;
      const pinHashes = TEAM_IDS.map((id) => data.teams[id].pinHash);

      data.energyOpened = incoming.energyOpened;
      data.teams = incoming.teams;
      data.challenges = incoming.challenges;
      data.auction = incoming.auction;
      data.auditLog = incoming.auditLog;
      data.gmPinHash = gmPinHash;
      data.sessionEpoch = sessionEpoch;
      TEAM_IDS.forEach((id, index) => {
        data.teams[id].pinHash = pinHashes[index];
        delete data.teams[id].redacted;
      });

      M.addAudit(data, actor, { action: "NẠP LẠI DỮ LIỆU TỪ FILE" });
      return;
    }

    default: {
      const exhaustive: never = action;
      throw new M.GameError(
        `Hành động không hợp lệ: ${JSON.stringify(exhaustive)}`,
      );
    }
  }
}
