import { computeProjection, getMaxInvestment, getAuctionFund } from "../src/lib/engine";
import { createInitialGameData } from "../src/lib/initialState";
import * as M from "../src/lib/mutations";
import type { Actor, ChallengeId, TeamId } from "../src/lib/types";
import { ForbiddenError, applyAction } from "../src/lib/server/dispatch";
import { redactForSession } from "../src/lib/server/redact";
import { verifyPin } from "../src/lib/server/crypto";
import {
  getActiveChallengeId,
  getNextChallengeId,
  hasPendingPublish,
  hasUnpublishedChanges,
} from "../src/lib/selectors";

let pass = 0;
let fail = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else {
    fail += 1;
    console.log(`✗ ${label}\n   nhận ${JSON.stringify(actual)} · mong đợi ${JSON.stringify(expected)}`);
  }
}

/* --- Trần đầu tư --- */
eq("maxInvestment(100)", getMaxInvestment(100), 30);
eq("maxInvestment(150)", getMaxInvestment(150), 45);
eq("maxInvestment(3)", getMaxInvestment(3), 1);
eq("maxInvestment(0)", getMaxInvestment(0), 0);

const P = (o: Partial<Parameters<typeof computeProjection>[0]>) =>
  computeProjection({
    challengeId: 1,
    energyBefore: 100,
    investment: 0,
    result: "WIN",
    boosterOwned: null,
    preBoosterActivation: false,
    reactiveBoosterActivation: false,
    ...o,
  } as Parameters<typeof computeProjection>[0]).projectedEnergy;

/* --- Ví dụ trong brief --- */
eq("TT1 WIN 100+20+50", P({ challengeId: 1, energyBefore: 100, investment: 20 }), 170);
eq("TT1 LOSE 100-20", P({ challengeId: 1, energyBefore: 100, investment: 20, result: "LOSE" }), 80);
eq("TT2 WIN 100+20+60", P({ challengeId: 2, energyBefore: 100, investment: 20 }), 180);
eq("TT3 WIN +70", P({ challengeId: 3, energyBefore: 100, investment: 0 }), 170);
eq("TT3 LOSE giữ nguyên", P({ challengeId: 3, energyBefore: 100, result: "LOSE" }), 100);
eq("TT3 bỏ qua investment nếu lỡ nhập", P({ challengeId: 3, energyBefore: 100, investment: 30, result: "LOSE" }), 100);

eq("TT4 Alpha WIN 150+30+90+40", P({ challengeId: 4, energyBefore: 150, investment: 30, boosterOwned: "ALPHA", preBoosterActivation: true }), 310);
eq("TT5 Alpha WIN 150+30+100+40", P({ challengeId: 5, energyBefore: 150, investment: 30, boosterOwned: "ALPHA", preBoosterActivation: true }), 320);
eq("TT4 Alpha LOSE 150-30-10", P({ challengeId: 4, energyBefore: 150, investment: 30, result: "LOSE", boosterOwned: "ALPHA", preBoosterActivation: true }), 110);
eq("Alpha LOSE chặn sàn 0", P({ challengeId: 4, energyBefore: 12, investment: 3, result: "LOSE", boosterOwned: "ALPHA", preBoosterActivation: true }), 0);

eq("TT4 Gamma WIN +45", P({ challengeId: 4, energyBefore: 150, investment: 30, boosterOwned: "GAMMA", preBoosterActivation: true }), 315);
eq("TT5 Gamma WIN +50", P({ challengeId: 5, energyBefore: 150, investment: 30, boosterOwned: "GAMMA", preBoosterActivation: true }), 330);
eq("Gamma LOSE không phạt thêm", P({ challengeId: 4, energyBefore: 150, investment: 30, result: "LOSE", boosterOwned: "GAMMA", preBoosterActivation: true }), 120);

eq("Beta inv 20 → mất 0", P({ challengeId: 4, energyBefore: 150, investment: 20, result: "LOSE", boosterOwned: "BETA", reactiveBoosterActivation: true }), 150);
eq("Beta inv 30 → mất 5", P({ challengeId: 4, energyBefore: 150, investment: 30, result: "LOSE", boosterOwned: "BETA", reactiveBoosterActivation: true }), 145);
eq("Beta không dùng khi WIN", P({ challengeId: 4, energyBefore: 150, investment: 30, boosterOwned: "BETA", reactiveBoosterActivation: true }), 270);

eq("Delta 100/30 → 85", P({ challengeId: 4, energyBefore: 100, investment: 30, result: "LOSE", boosterOwned: "DELTA", reactiveBoosterActivation: true }), 85);
eq("Delta trần refund 20", P({ challengeId: 5, energyBefore: 100, investment: 60, result: "LOSE", boosterOwned: "DELTA", reactiveBoosterActivation: true }), 60);
eq("Booster không hiệu lực ở TT1", P({ challengeId: 1, energyBefore: 100, investment: 20, boosterOwned: "ALPHA", preBoosterActivation: true }), 170);

/* --- Quỹ đấu giá --- */
eq("auctionFund(200)", getAuctionFund(200), 160);
eq("auctionFund(101)", getAuctionFund(101), 80);

/* --- Chạy thử một ván --- */
const gm: Actor = { name: "GM", role: "GM", teamId: null };
const g = createInitialGameData(100);
const T: TeamId[] = ["TEAM_1", "TEAM_2", "TEAM_3", "TEAM_4"];

M.openEnergy(g, gm, { TEAM_1: 100, TEAM_2: 100, TEAM_3: 100, TEAM_4: 100 });

function playChallenge(id: ChallengeId, inv: number[], results: ("WIN" | "LOSE")[]) {
  M.openChallenge(g, gm, id);
  if (g.challenges[id].status === "OPEN_FOR_INVESTMENT") {
    T.forEach((t, i) => M.submitInvestment(g, gm, t, id, inv[i], false));
    M.lockInvestment(g, gm, id);
  }
  M.startResultEntry(g, gm, id);
  T.forEach((t, i) => M.setResult(g, gm, t, id, results[i]));
  M.goToReview(g, gm, id);
  M.lockResult(g, gm, id);
}

playChallenge(1, [30, 30, 30, 30], ["WIN", "WIN", "LOSE", "LOSE"]);
eq("Sau TT1 — 2 thắng 2 thua", T.map((t) => g.teams[t].currentEnergy), [180, 180, 70, 70]);

playChallenge(2, [54, 54, 21, 21], ["WIN", "LOSE", "WIN", "LOSE"]);
eq("Sau TT2", T.map((t) => g.teams[t].currentEnergy), [294, 126, 151, 49]);

/* Đấu giá */
M.openSealedAuction(g, gm);
eq("Quỹ đấu giá sau TT2", T.map((t) => g.auction.teams[t].auctionFund), [235, 100, 120, 39]);

M.submitSealedBids(g, gm, "TEAM_1", { ALPHA: 50, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(g, gm, "TEAM_2", { ALPHA: 30, BETA: 20, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(g, gm, "TEAM_3", { ALPHA: 20, BETA: 20, GAMMA: 10, DELTA: 0 });
M.submitSealedBids(g, gm, "TEAM_4", { ALPHA: 5, BETA: 0, GAMMA: 0, DELTA: 0 });
M.lockSealedAuction(g, gm);
eq("Phase sau khi khóa phiếu", g.auction.phase, "SEALED_LOCKED");

// Ép thứ tự cố định để kiểm tra tiếp: ALPHA trước.
g.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
g.auction.currentLotIndex = 0;
g.auction.phase = "RUNNING";
M.prepareCurrentLot(g);
eq("ALPHA — top 2 vào đấu công khai", g.auction.lots.ALPHA.candidates, ["TEAM_1", "TEAM_2"]);
eq("ALPHA — giá khởi điểm", g.auction.lots.ALPHA.currentBid, 50);
eq("ALPHA — đội dẫn", g.auction.lots.ALPHA.currentLeader, "TEAM_1");

let threw = "";
try {
  M.placePublicBid(g, gm, "ALPHA", "TEAM_2", 52);
} catch (e) {
  threw = (e as Error).message;
}
eq("Chặn bid dưới bước +5", threw.includes("tối thiểu là 55"), true);

M.placePublicBid(g, gm, "ALPHA", "TEAM_2", 55);
M.placePublicBid(g, gm, "ALPHA", "TEAM_1", 60);
M.awardLot(g, gm, "ALPHA");
eq("TEAM_1 thắng ALPHA, trừ 60", [g.teams.TEAM_1.boosterOwned, g.teams.TEAM_1.currentEnergy], ["ALPHA", 234]);

// BETA: TEAM_2 và TEAM_3 cùng 20 → cả hai vào, không ai dẫn.
eq("BETA — hai đội cùng giá", g.auction.lots.BETA.candidates, ["TEAM_2", "TEAM_3"]);
eq("BETA — chưa có đội dẫn", g.auction.lots.BETA.currentLeader, null);
M.awardLot(g, gm, "BETA", "TEAM_3");
eq("TEAM_3 nhận BETA giá 20", [g.teams.TEAM_3.boosterOwned, g.teams.TEAM_3.currentEnergy], ["BETA", 131]);

// GAMMA: chỉ TEAM_3 đặt 10 nhưng đã có booster → không ai đủ điều kiện → SKIPPED, tự nhảy DELTA.
eq("GAMMA bị bỏ qua", g.auction.lots.GAMMA.status, "SKIPPED");
eq("DELTA không ai đặt giá → bỏ qua", g.auction.lots.DELTA.status, "SKIPPED");
eq("Chuyển sang phân bổ", g.auction.phase, "FALLBACK");

M.randomizeFallbackOrder(g, gm);
eq("Còn 2 đội chưa có Booster", M.getUnassignedTeams(g).length, 2);
const order = [...g.auction.fallbackOrder];
M.assignFallbackBooster(g, gm, order[0], M.getUnassignedBoosters(g)[0]);
M.assignFallbackBooster(g, gm, order[1], M.getUnassignedBoosters(g)[0]);
eq("Đấu giá hoàn tất", g.auction.phase, "DONE");
eq("Cả 4 đội đều có Booster", T.every((t) => g.teams[t].boosterOwned !== null), true);
eq("TEAM_4 quỹ 39 → giá sàn 5", g.teams.TEAM_4.currentEnergy, 44);

/* Reopen */
const before = T.map((t) => g.teams[t].currentEnergy);
M.openChallenge(g, gm, 3);
M.startResultEntry(g, gm, 3);
T.forEach((t) => M.setResult(g, gm, t, 3, "WIN"));
M.lockResult(g, gm, 3);
eq("TT3 thắng cả 4 → +70", T.map((t) => g.teams[t].currentEnergy), before.map((v) => v + 70));
M.reopenResult(g, gm, 3, "PIC nhập nhầm");
eq("Reopen hoàn Energy về trước vòng", T.map((t) => g.teams[t].currentEnergy), before);
eq("Reopen có ghi lý do", g.auditLog[0].reason, "PIC nhập nhầm");

/* Scoreboard snapshot */
M.setResult(g, gm, "TEAM_1", 3, "WIN");
T.slice(1).forEach((t) => M.setResult(g, gm, t, 3, "LOSE"));
M.lockResult(g, gm, 3);
eq("LED chưa đổi trước khi Publish", g.teams.TEAM_1.publishedEnergy !== g.teams.TEAM_1.currentEnergy, true);
M.publishScoreboard(g, gm);
eq("LED khớp sau Publish", g.teams.TEAM_1.publishedEnergy, g.teams.TEAM_1.currentEnergy);

/* --- Phân quyền phía server --- */
const gmSession = { role: "GM" as const, teamId: null, name: "Game Master" };
const team1Session = {
  role: "CARE_TEAM" as const,
  teamId: "TEAM_1" as TeamId,
  name: "TEAM ALPHA",
};

function refuses(label: string, run: () => void, kind: "quyền" | "luật") {
  try {
    run();
    eq(label, "không chặn", "phải chặn");
  } catch (err) {
    const isForbidden = err instanceof ForbiddenError;
    eq(label, isForbidden ? "quyền" : "luật", kind);
  }
}

M.openChallenge(g, gm, 4);

refuses(
  "Care Team không khóa được kết quả",
  () => applyAction(g, { type: "lockResult", challengeId: 4 }, team1Session),
  "quyền",
);
refuses(
  "Care Team không mở được vòng",
  () => applyAction(g, { type: "openChallenge", challengeId: 5 }, team1Session),
  "quyền",
);
refuses(
  "Care Team không publish được scoreboard",
  () => applyAction(g, { type: "publishScoreboard" }, team1Session),
  "quyền",
);
refuses(
  "Care Team không đổi được PIN Game Master",
  () => applyAction(g, { type: "setGmPin", pin: "0000" }, team1Session),
  "quyền",
);
refuses(
  "Care Team không khôi phục được về mặc định",
  () => applyAction(g, { type: "factoryReset", startEnergy: 100 }, team1Session),
  "quyền",
);
refuses(
  "Care Team không nhập hộ đội khác",
  () =>
    applyAction(
      g,
      {
        type: "submitInvestment",
        teamId: "TEAM_2",
        challengeId: 4,
        investment: 10,
        preBoosterActivation: false,
      },
      team1Session,
    ),
  "quyền",
);

applyAction(
  g,
  {
    type: "submitInvestment",
    teamId: "TEAM_1",
    challengeId: 4,
    investment: 10,
    preBoosterActivation: false,
  },
  team1Session,
);
eq("Care Team nhập được cho chính đội mình", g.challenges[4].entries.TEAM_1.investment, 10);

// Sai luật chơi vẫn phải bị chặn, kể cả khi đúng quyền.
refuses(
  "Investment vượt trần bị chặn dù đúng quyền",
  () =>
    applyAction(
      g,
      {
        type: "submitInvestment",
        teamId: "TEAM_1",
        challengeId: 4,
        investment: 99999,
        preBoosterActivation: false,
      },
      team1Session,
    ),
  "luật",
);

/* --- Lọc dữ liệu trước khi rời server --- */
applyAction(
  g,
  {
    type: "submitInvestment",
    teamId: "TEAM_2",
    challengeId: 4,
    investment: 12,
    preBoosterActivation: false,
  },
  gmSession,
);

const forTeam1 = redactForSession(g, team1Session);
eq("Đội khác bị giấu Energy nội bộ", forTeam1.teams.TEAM_2.currentEnergy, 0);
eq("Đội khác được đánh dấu đã lọc", forTeam1.teams.TEAM_2.redacted, true);
eq("Đội mình vẫn thấy Energy thật", forTeam1.teams.TEAM_1.currentEnergy, g.teams.TEAM_1.currentEnergy);
eq("Không thấy Investment đội khác", forTeam1.challenges[4].entries.TEAM_2.investment, null);
eq("Vẫn thấy Investment đội mình", forTeam1.challenges[4].entries.TEAM_1.investment, 10);
eq("Không thấy giá kín đội khác", forTeam1.auction.teams.TEAM_2.bids, {
  ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 0,
});
eq("Vẫn thấy giá kín đội mình", forTeam1.auction.teams.TEAM_1.bids.ALPHA, g.auction.teams.TEAM_1.bids.ALPHA);
eq("Không thấy quỹ đấu giá đội khác", forTeam1.auction.teams.TEAM_2.auctionFund, 0);
eq("Care Team không đọc được nhật ký", forTeam1.auditLog.length, 0);
eq("PIN không rời khỏi server (Care Team)", forTeam1.teams.TEAM_1.pinHash, "");

const forGm = redactForSession(g, gmSession);
eq("GM thấy đủ 4 đội", forGm.teams.TEAM_2.currentEnergy, g.teams.TEAM_2.currentEnergy);
eq("GM thấy ma trận giá kín", forGm.auction.teams.TEAM_2.bids.ALPHA, g.auction.teams.TEAM_2.bids.ALPHA);
eq("GM đọc được nhật ký", forGm.auditLog.length > 0, true);
eq("PIN không rời khỏi server (GM)", forGm.gmPinHash, "");

const forPublic = redactForSession(g, null);
eq("Khách chỉ thấy điểm đã công bố", forPublic.teams.TEAM_1.publishedEnergy, g.teams.TEAM_1.publishedEnergy);
eq("Khách không thấy Energy nội bộ", forPublic.teams.TEAM_1.currentEnergy, 0);
eq("Khách không thấy Booster", forPublic.teams.TEAM_1.boosterOwned, null);
eq("Khách không thấy diễn biến vòng", forPublic.challenges[4].entries.TEAM_1.investment, null);



/* --- Khôi phục về mặc định --- */
const beforeFactory = JSON.stringify(g.teams.TEAM_1);
applyAction(g, { type: "setTeamProfile", teamId: "TEAM_1", name: "ĐỘI ĐỔI TÊN" }, gmSession);
eq("Đổi được tên đội", g.teams.TEAM_1.name, "ĐỘI ĐỔI TÊN");

const pinBefore = g.teams.TEAM_1.pinHash;
applyAction(g, { type: "factoryReset", startEnergy: 120 }, gmSession);
eq("Factory reset — tên đội về mặc định", g.teams.TEAM_1.name, "TEAM ALPHA");
eq("Factory reset — Energy về giá trị mới", T.map((t) => g.teams[t].currentEnergy), [120, 120, 120, 120]);
eq("Factory reset — LED cũng về theo", g.teams.TEAM_1.publishedEnergy, 120);
eq("Factory reset — sinh PIN mới", g.teams.TEAM_1.pinHash !== pinBefore, true);
eq("Factory reset — PIN mặc định dùng được", verifyPin("1111", g.teams.TEAM_1.pinHash), true);
eq("Factory reset — PIN GM về mặc định", verifyPin("9999", g.gmPinHash), true);
eq("Factory reset — xóa Booster", T.every((t) => g.teams[t].boosterOwned === null), true);
eq("Factory reset — xóa đấu giá", g.auction.phase, "IDLE");
eq("Factory reset — mọi vòng về IDLE", [1, 2, 3, 4, 5].map((id) => g.challenges[id as ChallengeId].status), ["IDLE", "IDLE", "IDLE", "IDLE", "IDLE"]);
eq("Factory reset — đóng lại nguồn Energy", g.energyOpened, false);
eq("Factory reset — nhật ký chỉ còn dòng ghi việc reset", g.auditLog.length, 1);
eq("Factory reset — có ghi vào nhật ký", g.auditLog[0].action, "KHÔI PHỤC TOÀN BỘ VỀ MẶC ĐỊNH");
eq("Factory reset — state thực sự đổi", JSON.stringify(g.teams.TEAM_1) !== beforeFactory, true);



/* --- Không được kẹt sau khi khóa kết quả một vòng không đổi Energy --- */
const k = createInitialGameData(100, () => "hash");
M.openEnergy(k, gm, { TEAM_1: 100, TEAM_2: 100, TEAM_3: 100, TEAM_4: 100 });

// Chơi TT1, TT2 cho đúng trình tự rồi mới tới TT3.
for (const id of [1, 2] as ChallengeId[]) {
  M.openChallenge(k, gm, id);
  T.forEach((t) => M.submitInvestment(k, gm, t, id, 10, false));
  M.lockInvestment(k, gm, id);
  M.startResultEntry(k, gm, id);
  T.forEach((t) => M.setResult(k, gm, t, id, "WIN"));
  M.lockResult(k, gm, id);
}
M.publishScoreboard(k, gm);

// TT3: cả 4 đội cùng thua → Energy giữ nguyên → không có gì để Publish.
M.openChallenge(k, gm, 3);
M.startResultEntry(k, gm, 3);
T.forEach((t) => M.setResult(k, gm, t, 3, "LOSE"));
M.lockResult(k, gm, 3);

const afterTT2 = T.map((t) => k.teams[t].currentEnergy);
eq("TT3 thua hết — Energy không đổi", T.map((t) => k.teams[t].currentEnergy), afterTT2);
eq("Không có chênh lệch với LED", hasUnpublishedChanges(k), false);
eq("Nhưng vẫn còn việc để Publish", hasPendingPublish(k), true);
eq("Vòng đang điều hành vẫn là TT3", getActiveChallengeId(k), 3);
eq("Và TT4 sẵn sàng để mở", getNextChallengeId(k), 4);

// Mở TT4 ngay, không cần Publish trước.
M.openChallenge(k, gm, 4);
eq("Mở được TT4 khi TT3 mới chỉ khóa", k.challenges[4].status, "OPEN_FOR_INVESTMENT");
eq("Màn điều hành chuyển sang TT4", getActiveChallengeId(k), 4);

// Publish sau đó vẫn đưa TT3 sang PUBLISHED.
M.publishScoreboard(k, gm);
eq("TT3 chuyển sang đã công bố", k.challenges[3].status, "PUBLISHED");
eq("Hết việc phải công bố", hasPendingPublish(k), false);

console.log(`\n${pass} đạt / ${fail} lỗi`);
process.exit(fail > 0 ? 1 : 0);
