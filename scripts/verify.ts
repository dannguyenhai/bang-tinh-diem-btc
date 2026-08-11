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
// Thứ tự phân bổ do bốc thăm nên không cố định đội nào là món cuối:
// kiểm theo tập hợp giá đã trả thay vì theo tên đội.
const paidG = ["TEAM_2", "TEAM_4"].map(
  (t) => g.auction.teams[t as TeamId].energySnapshot - g.teams[t as TeamId].currentEnergy,
);
eq("Một đội trả giá sàn 5, đội chốt sổ trả nửa quỹ", paidG.includes(5), true);
eq("Đúng hai đội được phân bổ", paidG.length, 2);

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
// Ở thời điểm này đấu giá đã chốt, nên Booster là thông tin sân khấu.
eq("Khách thấy Booster sau khi đấu giá chốt", forPublic.teams.TEAM_1.boosterOwned !== null, true);
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



/* --- Vòng đời Booster qua TT4 và TT5 --- */
function newGameAt4(booster: "ALPHA" | "BETA" | "GAMMA" | "DELTA") {
  const s = createInitialGameData(100, () => "hash");
  M.openEnergy(s, gm, { TEAM_1: 200, TEAM_2: 200, TEAM_3: 200, TEAM_4: 200 });
  for (const id of [1, 2, 3] as ChallengeId[]) {
    M.openChallenge(s, gm, id);
    if (s.challenges[id].status === "OPEN_FOR_INVESTMENT") {
      T.forEach((t) => M.submitInvestment(s, gm, t, id, 1, false));
      M.lockInvestment(s, gm, id);
    }
    M.startResultEntry(s, gm, id);
    T.forEach((t) => M.setResult(s, gm, t, id, "LOSE"));
    M.lockResult(s, gm, id);
  }
  T.forEach((t) => { s.teams[t].boosterOwned = booster; });
  return s;
}

/* Alpha: chọn KHÔNG ở TT4 → giữ nguyên, TT5 vẫn được hỏi */
const a = newGameAt4("ALPHA");
M.openChallenge(a, gm, 4);
T.forEach((t) => M.submitInvestment(a, gm, t, 4, 20, false));
M.lockInvestment(a, gm, 4);
M.startResultEntry(a, gm, 4);
T.forEach((t) => M.setResult(a, gm, t, 4, "WIN"));
M.lockResult(a, gm, 4);
eq("Alpha chọn KHÔNG ở TT4 → chưa bị tiêu", a.teams.TEAM_1.boosterUsed, false);
eq("Alpha chọn KHÔNG → thắng chỉ nhận reward + investment", a.teams.TEAM_1.currentEnergy, a.challenges[4].entries.TEAM_1.energyBefore! + 90 + 20);

M.publishScoreboard(a, gm);
M.openChallenge(a, gm, 5);
T.forEach((t) => M.submitInvestment(a, gm, t, 5, 20, true));
M.lockInvestment(a, gm, 5);
M.startResultEntry(a, gm, 5);
T.forEach((t) => M.setResult(a, gm, t, 5, "WIN"));
const beforeTT5 = a.challenges[5].entries.TEAM_1.energyBefore!;
M.lockResult(a, gm, 5);
eq("Alpha để dành được tới TT5", a.teams.TEAM_1.currentEnergy, beforeTT5 + 100 + 20 + 40);
eq("Sau TT5 Alpha mới tính là đã dùng", a.teams.TEAM_1.boosterUsed, true);
eq("Ghi nhận dùng ở đúng vòng 5", a.teams.TEAM_1.boosterActivatedAtChallenge, 5);

/* Alpha: chọn CÓ ở TT4 → tiêu ngay, TT5 không được hỏi nữa */
const a2 = newGameAt4("ALPHA");
M.openChallenge(a2, gm, 4);
T.forEach((t) => M.submitInvestment(a2, gm, t, 4, 20, true));
M.lockInvestment(a2, gm, 4);
M.startResultEntry(a2, gm, 4);
T.forEach((t) => M.setResult(a2, gm, t, 4, "WIN"));
M.lockResult(a2, gm, 4);
eq("Alpha chọn CÓ → tiêu ngay ở TT4", a2.teams.TEAM_1.boosterUsed, true);

M.publishScoreboard(a2, gm);
M.openChallenge(a2, gm, 5);
M.submitInvestment(a2, gm, "TEAM_1", 5, 20, true);
eq("TT5 không kích hoạt lại được Booster đã dùng", a2.challenges[5].entries.TEAM_1.preBoosterActivation, false);

/* Beta: thắng TT4 thì không bị hỏi, Booster còn nguyên cho TT5 */
const bt = newGameAt4("BETA");
M.openChallenge(bt, gm, 4);
T.forEach((t) => M.submitInvestment(bt, gm, t, 4, 30, false));
M.lockInvestment(bt, gm, 4);
M.startResultEntry(bt, gm, 4);
M.setResult(bt, gm, "TEAM_1", 4, "WIN");
T.slice(1).forEach((t) => M.setResult(bt, gm, t, 4, "LOSE"));
eq("Đội thắng không nằm trong nhóm được hỏi Booster", M.getBoosterResponseTeams(bt, 4).includes("TEAM_1"), false);
eq("Ba đội thua thì được hỏi", M.getBoosterResponseTeams(bt, 4).length, 3);

M.openBoosterResponse(bt, gm, 4);
M.setReactiveBooster(bt, gm, "TEAM_2", 4, true);   // dùng
M.setReactiveBooster(bt, gm, "TEAM_3", 4, false);  // giữ
M.closeBoosterResponse(bt, gm, 4);
const beta3Before = bt.challenges[4].entries.TEAM_3.energyBefore!;
M.lockResult(bt, gm, 4);
eq("Beta DÙNG → che 25 trong 30 đã mất", bt.teams.TEAM_2.currentEnergy, bt.challenges[4].entries.TEAM_2.energyBefore! - 5);
eq("Beta DÙNG → tiêu Booster", bt.teams.TEAM_2.boosterUsed, true);
eq("Beta GIỮ → mất trọn Investment", bt.teams.TEAM_3.currentEnergy, beta3Before - 30);
eq("Beta GIỮ → Booster còn nguyên", bt.teams.TEAM_3.boosterUsed, false);
eq("Đội thắng giữ nguyên Booster", bt.teams.TEAM_1.boosterUsed, false);

M.publishScoreboard(bt, gm);
M.openChallenge(bt, gm, 5);
T.forEach((t) => M.submitInvestment(bt, gm, t, 5, 30, false));
M.lockInvestment(bt, gm, 5);
M.startResultEntry(bt, gm, 5);
T.forEach((t) => M.setResult(bt, gm, t, 5, "LOSE"));
const askedAtTT5 = M.getBoosterResponseTeams(bt, 5);
eq("TT5 hỏi lại đội đã GIỮ", askedAtTT5.includes("TEAM_3"), true);
eq("TT5 vẫn hỏi đội thắng ở TT4", askedAtTT5.includes("TEAM_1"), true);
eq("TT5 không hỏi đội đã DÙNG", askedAtTT5.includes("TEAM_2"), false);

/* Delta: chỉ mở khi Energy sau khi thua ≤ 80 */
const d = newGameAt4("DELTA");
d.teams.TEAM_1.currentEnergy = 100;
d.teams.TEAM_2.currentEnergy = 300;
M.openChallenge(d, gm, 4);
M.submitInvestment(d, gm, "TEAM_1", 4, 30, false);
M.submitInvestment(d, gm, "TEAM_2", 4, 30, false);
M.submitInvestment(d, gm, "TEAM_3", 4, 30, false);
M.submitInvestment(d, gm, "TEAM_4", 4, 30, false);
M.lockInvestment(d, gm, 4);
M.startResultEntry(d, gm, 4);
T.forEach((t) => M.setResult(d, gm, t, 4, "LOSE"));
const deltaAsked = M.getBoosterResponseTeams(d, 4);
eq("Đội Energy thấp thua → được hỏi Delta", deltaAsked.includes("TEAM_1"), true);
eq("Đội Energy cao thua cũng được hỏi Delta", deltaAsked.includes("TEAM_2"), true);
eq("Cả 4 đội thua đều được hỏi", deltaAsked.length, 4);
M.openBoosterResponse(d, gm, 4);
M.setReactiveBooster(d, gm, "TEAM_1", 4, true);
M.closeBoosterResponse(d, gm, 4);
M.lockResult(d, gm, 4);
eq("Delta hoàn 50% của 30, tối đa 20 → 85", d.teams.TEAM_1.currentEnergy, 85);



/* --- Đấu giá: các tình huống hiểm --- */
function auctionReady(energies: number[]) {
  const s = createInitialGameData(100, () => "hash");
  const map = {} as Record<TeamId, number>;
  T.forEach((t, i) => { map[t] = energies[i]; });
  M.openEnergy(s, gm, map);
  for (const id of [1, 2] as ChallengeId[]) {
    M.openChallenge(s, gm, id);
    T.forEach((t) => M.submitInvestment(s, gm, t, id, 1, false));
    M.lockInvestment(s, gm, id);
    M.startResultEntry(s, gm, id);
    T.forEach((t) => M.setResult(s, gm, t, id, "LOSE"));
    M.lockResult(s, gm, id);
  }
  M.openSealedAuction(s, gm);
  return s;
}

/* (1) Cả 4 đội dồn hết tiền vào đúng một Booster */
const allin = auctionReady([100, 100, 100, 100]);
const fundAll = allin.auction.teams.TEAM_1.auctionFund;
T.forEach((t) =>
  M.submitSealedBids(allin, gm, t, { ALPHA: fundAll, BETA: 0, GAMMA: 0, DELTA: 0 }),
);
M.lockSealedAuction(allin, gm);
allin.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
allin.auction.currentLotIndex = 0;
allin.auction.phase = "RUNNING";
M.prepareCurrentLot(allin);

eq("All-in ALPHA — 4 đội bằng giá, phải bốc thăm chọn 2 suất", allin.auction.lots.ALPHA.status, "TIE_BREAK");
eq("Bốc thăm cho 2 suất", allin.auction.lots.ALPHA.tieSlots, 2);
eq("Cả 4 đội đều trong nhóm hòa", allin.auction.lots.ALPHA.tieCandidates.length, 4);

M.resolveTie(allin, gm, "ALPHA", "TEAM_1");
M.resolveTie(allin, gm, "ALPHA", "TEAM_2");
eq("Chọn xong 2 đội thì vào đấu công khai", allin.auction.lots.ALPHA.status, "PUBLIC");
eq("Hai đội bằng giá → chưa ai dẫn", allin.auction.lots.ALPHA.currentLeader, null);

// Cả hai đã ở trần quỹ nên không ai nâng thêm được.
eq("Bước giá tiếp theo vượt trần quỹ", M.getMinNextBid(allin, "ALPHA") > fundAll, true);
let blocked = "";
try { M.placePublicBid(allin, gm, "ALPHA", "TEAM_2", fundAll + 5); }
catch (e) { blocked = (e as Error).message; }
eq("Nâng quá quỹ bị chặn", blocked.includes("Vượt quỹ"), true);

M.awardLot(allin, gm, "ALPHA", "TEAM_1"); // GM bốc thăm ngoài sân khấu
eq("TEAM_1 thắng ALPHA", allin.teams.TEAM_1.boosterOwned, "ALPHA");
eq("Ba Booster còn lại không ai đặt giá → bỏ qua hết", ["BETA","GAMMA","DELTA"].every((b) => allin.auction.lots[b as "BETA"].status === "SKIPPED"), true);
eq("Chuyển sang phân bổ", allin.auction.phase, "FALLBACK");

M.randomizeFallbackOrder(allin, gm);
for (let i = 0; i < 3; i += 1) {
  const turn = M.getUnassignedTeams(allin)[0];
  const free = M.getUnassignedBoosters(allin)[0];
  M.assignFallbackBooster(allin, gm, allin.auction.fallbackOrder.find((t) => !allin.teams[t].boosterOwned)!, free);
  void turn;
}
eq("KHÔNG đội nào ra về tay trắng", T.every((t) => allin.teams[t].boosterOwned !== null), true);
eq("Bốn Booster về bốn đội khác nhau", new Set(T.map((t) => allin.teams[t].boosterOwned)).size, 4);
eq("Đấu giá kết thúc", allin.auction.phase, "DONE");
const paidAllin = T.filter((t) => t !== allin.auction.lots.ALPHA.winner)
  .map((t) => allin.auction.teams[t].energySnapshot - allin.teams[t].currentEnergy)
  .sort((a, b) => a - b);
const halfFund = Math.floor(allin.auction.teams.TEAM_1.auctionFund / 2);
eq("Hai đội giữa trả giá sàn, đội chốt sổ trả nửa quỹ", paidAllin, [5, 5, halfFund]);

/* (2) Hai đội cùng trần quỹ, cùng all-in → bế tắc, GM bốc thăm */
const tie2 = auctionReady([100, 100, 40, 40]);
const f1 = tie2.auction.teams.TEAM_1.auctionFund;
M.submitSealedBids(tie2, gm, "TEAM_1", { ALPHA: f1, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(tie2, gm, "TEAM_2", { ALPHA: f1, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(tie2, gm, "TEAM_3", { ALPHA: 0, BETA: 3, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(tie2, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 3, DELTA: 0 });
M.lockSealedAuction(tie2, gm);
tie2.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
tie2.auction.currentLotIndex = 0;
tie2.auction.phase = "RUNNING";
M.prepareCurrentLot(tie2);
eq("Đúng 2 đội bằng giá → vào thẳng đấu công khai, không cần bốc thăm suất", tie2.auction.lots.ALPHA.status, "PUBLIC");
eq("Không đội nào được coi là đang dẫn", tie2.auction.lots.ALPHA.currentLeader, null);
eq("Có ghi chú nhắc GM", tie2.auction.lots.ALPHA.note !== null, true);
M.awardLot(tie2, gm, "ALPHA", "TEAM_2");
eq("GM trao được cho đội bốc thăm trúng", tie2.auction.lots.ALPHA.winner, "TEAM_2");
eq("Trả đúng giá đang đứng", tie2.auction.lots.ALPHA.winningPrice, f1);

/* (3) Chỉ một đội đặt giá cho lô đó → thắng ngay, không cần đấu */
const solo = auctionReady([100, 100, 100, 100]);
M.submitSealedBids(solo, gm, "TEAM_1", { ALPHA: 10, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(solo, gm, "TEAM_2", { ALPHA: 0, BETA: 10, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(solo, gm, "TEAM_3", { ALPHA: 0, BETA: 0, GAMMA: 10, DELTA: 0 });
M.submitSealedBids(solo, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 10 });
M.lockSealedAuction(solo, gm);
solo.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
solo.auction.currentLotIndex = 0;
solo.auction.phase = "RUNNING";
M.prepareCurrentLot(solo);
eq("Một mình một giá → thành đội dẫn ngay", solo.auction.lots.ALPHA.currentLeader, "TEAM_1");
eq("Giá đúng bằng giá kín", solo.auction.lots.ALPHA.currentBid, 10);



/* --- Bốc thăm tự động khi bằng giá --- */
const r1 = auctionReady([100, 100, 100, 100]);
const fr = r1.auction.teams.TEAM_1.auctionFund;
T.forEach((t) => M.submitSealedBids(r1, gm, t, { ALPHA: fr, BETA: 0, GAMMA: 0, DELTA: 0 }));
M.lockSealedAuction(r1, gm);
r1.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
r1.auction.currentLotIndex = 0;
r1.auction.phase = "RUNNING";
M.prepareCurrentLot(r1);

M.resolveTieRandom(r1, gm, "ALPHA");
eq("Bốc thăm tự động chọn đủ 2 suất", r1.auction.lots.ALPHA.candidates.length, 2);
eq("Hai đội được chọn khác nhau", new Set(r1.auction.lots.ALPHA.candidates).size, 2);
eq("Chuyển sang đấu công khai", r1.auction.lots.ALPHA.status, "PUBLIC");
eq("Hết nhóm chờ bốc thăm", r1.auction.lots.ALPHA.tieCandidates.length, 0);
eq("Có ghi nhật ký việc bốc thăm", r1.auditLog[0].action.includes("Bốc thăm ngẫu nhiên"), true);

M.awardLotRandom(r1, gm, "ALPHA");
const champ = r1.auction.lots.ALPHA.winner!;
eq("Trao được cho một trong hai đội đã bốc", r1.auction.lots.ALPHA.candidates.includes(champ), true);
eq("Đội thắng nhận Booster", r1.teams[champ].boosterOwned, "ALPHA");
eq("Trừ đúng giá đang đứng", r1.teams[champ].currentEnergy, r1.auction.teams[champ].energySnapshot - fr);

// Khi đã có đội dẫn giá thì không bốc thăm nữa, trao thẳng cho đội đó.
const r2 = auctionReady([100, 100, 100, 100]);
M.submitSealedBids(r2, gm, "TEAM_1", { ALPHA: 40, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(r2, gm, "TEAM_2", { ALPHA: 20, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(r2, gm, "TEAM_3", { ALPHA: 0, BETA: 5, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(r2, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 5, DELTA: 0 });
M.lockSealedAuction(r2, gm);
r2.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
r2.auction.currentLotIndex = 0;
r2.auction.phase = "RUNNING";
M.prepareCurrentLot(r2);
M.awardLotRandom(r2, gm, "ALPHA");
eq("Có đội dẫn thì trao đúng đội đó, không random", r2.auction.lots.ALPHA.winner, "TEAM_1");



/* --- Màn LED chỉ hiện Booster sau khi đấu giá chốt xong --- */
const led = auctionReady([100, 100, 100, 100]);
T.forEach((t, i) => {
  const bids = { ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 0 };
  bids[(["ALPHA", "BETA", "GAMMA", "DELTA"] as const)[i]] = 10;
  M.submitSealedBids(led, gm, t, bids);
});
M.lockSealedAuction(led, gm);
led.auction.order = ["ALPHA", "BETA", "GAMMA", "DELTA"];
led.auction.currentLotIndex = 0;
led.auction.phase = "RUNNING";
M.prepareCurrentLot(led);

const midAuction = redactForSession(led, null);
eq("Đang đấu giá — LED chưa hiện Booster", midAuction.teams.TEAM_1.boosterOwned, null);

for (const b of ["ALPHA", "BETA", "GAMMA", "DELTA"] as const) {
  if (led.auction.lots[b].status === "PUBLIC") M.awardLot(led, gm, b);
}
eq("Đấu giá đã chốt", led.auction.phase, "DONE");

const afterAuction = redactForSession(led, null);
eq("Xong đấu giá — LED hiện Booster", afterAuction.teams.TEAM_1.boosterOwned, "ALPHA");
eq("LED biết Booster còn hay đã dùng", afterAuction.teams.TEAM_1.boosterUsed, false);
eq("Nhưng vẫn giấu Energy nội bộ", afterAuction.teams.TEAM_1.currentEnergy, 0);
eq("Và giấu vòng đã kích hoạt", afterAuction.teams.TEAM_1.boosterActivatedAtChallenge, null);
eq("LED vẫn không đọc được nhật ký", afterAuction.auditLog.length, 0);
eq("LED vẫn không thấy giá kín", afterAuction.auction.teams.TEAM_2.bids.BETA, 0);



/* --- Delta: thua là được quyền dùng, không còn ngưỡng Energy --- */
const dlt = createInitialGameData(100, () => "hash");
M.openEnergy(dlt, gm, { TEAM_1: 183, TEAM_2: 183, TEAM_3: 183, TEAM_4: 183 });
for (const id of [1, 2, 3, 4] as ChallengeId[]) {
  M.openChallenge(dlt, gm, id);
  if (dlt.challenges[id].status === "OPEN_FOR_INVESTMENT") {
    T.forEach((t) => M.submitInvestment(dlt, gm, t, id, 1, false));
    M.lockInvestment(dlt, gm, id);
  }
  M.startResultEntry(dlt, gm, id);
  T.forEach((t) => M.setResult(dlt, gm, t, id, "LOSE"));
  M.lockResult(dlt, gm, id);
}
T.forEach((t) => { dlt.teams[t].boosterOwned = "DELTA"; dlt.teams[t].currentEnergy = 183; });

M.openChallenge(dlt, gm, 5);
M.submitInvestment(dlt, gm, "TEAM_1", 5, 54, false); // 183 - 54 = 129 > 80
M.submitInvestment(dlt, gm, "TEAM_2", 5, 54, false);
M.submitInvestment(dlt, gm, "TEAM_3", 5, 54, false);
M.submitInvestment(dlt, gm, "TEAM_4", 5, 54, false);
M.lockInvestment(dlt, gm, 5);
M.startResultEntry(dlt, gm, 5);
T.forEach((t) => M.setResult(dlt, gm, t, 5, "LOSE"));

eq("Energy cao vẫn được hỏi Delta khi thua", M.getBoosterResponseTeams(dlt, 5).length, 4);

M.openBoosterResponse(dlt, gm, 5);
M.setReactiveBooster(dlt, gm, "TEAM_1", 5, true);
M.setReactiveBooster(dlt, gm, "TEAM_2", 5, false);
M.closeBoosterResponse(dlt, gm, 5);
M.lockResult(dlt, gm, 5);
eq("Delta hoàn min(54/2, 20) = 20", dlt.teams.TEAM_1.currentEnergy, 183 - 54 + 20);
eq("Dùng rồi thì tiêu Booster", dlt.teams.TEAM_1.boosterUsed, true);
eq("Đội giữ lại thì mất trọn Investment", dlt.teams.TEAM_2.currentEnergy, 183 - 54);
eq("Và Booster còn nguyên", dlt.teams.TEAM_2.boosterUsed, false);



/* --- Luật đấu giá mới --- */

/* (a) Booster được đặt nhiều điểm nhất lên sàn trước */
const ord = auctionReady([200, 200, 200, 200]);
M.submitSealedBids(ord, gm, "TEAM_1", { ALPHA: 5, BETA: 40, GAMMA: 0, DELTA: 10 });
M.submitSealedBids(ord, gm, "TEAM_2", { ALPHA: 0, BETA: 30, GAMMA: 20, DELTA: 0 });
M.submitSealedBids(ord, gm, "TEAM_3", { ALPHA: 10, BETA: 0, GAMMA: 25, DELTA: 5 });
M.submitSealedBids(ord, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 5, DELTA: 3 });
M.lockSealedAuction(ord, gm);

eq("Tổng đặt vào BETA", M.getBoosterDemand(ord, "BETA"), 70);
eq("Tổng đặt vào GAMMA", M.getBoosterDemand(ord, "GAMMA"), 50);
eq("Tổng đặt vào DELTA", M.getBoosterDemand(ord, "DELTA"), 18);
eq("Tổng đặt vào ALPHA", M.getBoosterDemand(ord, "ALPHA"), 15);

M.orderAuctionLots(ord, gm);
eq("Thứ tự lên sàn theo mức quan tâm giảm dần", ord.auction.order, ["BETA", "GAMMA", "DELTA", "ALPHA"]);
eq("Vào thẳng vòng đấu", ord.auction.phase, "RUNNING");
eq("Nhật ký ghi kèm tổng điểm", ord.auditLog.some((e) => e.action.includes("MỨC QUAN TÂM")), true);

/* (b) Trao qua bốc thăm → trả đúng giá kín của chính đội thắng */
const pay = auctionReady([200, 200, 200, 200]);
M.submitSealedBids(pay, gm, "TEAM_1", { ALPHA: 60, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(pay, gm, "TEAM_2", { ALPHA: 60, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(pay, gm, "TEAM_3", { ALPHA: 0, BETA: 5, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(pay, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 5, DELTA: 0 });
M.lockSealedAuction(pay, gm);
M.orderAuctionLots(pay, gm);
eq("ALPHA nóng nhất nên lên trước", pay.auction.order[0], "ALPHA");
eq("Hai đội bằng giá → chưa ai dẫn", pay.auction.lots.ALPHA.currentLeader, null);

const snap2 = pay.auction.teams.TEAM_2.energySnapshot;
M.awardLotRandom(pay, gm, "ALPHA");
const won = pay.auction.lots.ALPHA.winner!;
eq("Trả đúng giá kín của đội thắng", pay.auction.lots.ALPHA.winningPrice, pay.auction.teams[won].bids.ALPHA);
if (won === "TEAM_2") eq("Trừ đúng số đó khỏi Energy", pay.teams.TEAM_2.currentEnergy, snap2 - 60);

// Nếu đã có nâng giá công khai thì trả theo giá chốt, không quay về giá kín.
const pub = auctionReady([200, 200, 200, 200]);
M.submitSealedBids(pub, gm, "TEAM_1", { ALPHA: 50, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(pub, gm, "TEAM_2", { ALPHA: 30, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(pub, gm, "TEAM_3", { ALPHA: 0, BETA: 5, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(pub, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 5, DELTA: 0 });
M.lockSealedAuction(pub, gm);
M.orderAuctionLots(pub, gm);
M.placePublicBid(pub, gm, "ALPHA", "TEAM_2", 55);
M.awardLot(pub, gm, "ALPHA");
eq("Có nâng giá thì trả giá chốt 55", pub.auction.lots.ALPHA.winningPrice, 55);
eq("Đội nâng giá là đội thắng", pub.auction.lots.ALPHA.winner, "TEAM_2");

/* (c) Booster cuối cùng: nửa quỹ */
const last = auctionReady([100, 100, 100, 100]);
const lf = last.auction.teams.TEAM_1.auctionFund; // 80
T.forEach((t) => M.submitSealedBids(last, gm, t, { ALPHA: 10, BETA: 0, GAMMA: 0, DELTA: 0 }));
M.lockSealedAuction(last, gm);
M.orderAuctionLots(last, gm);
M.resolveTieRandom(last, gm, "ALPHA");
M.awardLotRandom(last, gm, "ALPHA");
eq("Ba Booster kia không ai đặt → xuống phân bổ", last.auction.phase, "FALLBACK");

M.randomizeFallbackOrder(last, gm);
const line = last.auction.fallbackOrder.filter((t) => !last.teams[t].boosterOwned);
eq("Còn 3 đội chờ phân bổ", line.length, 3);

// Hai món giữa vẫn theo giá sàn.
eq("Món chưa phải cuối → giá sàn 5", M.getFallbackPrice(last, line[0], M.getUnassignedBoosters(last)[0]), 5);
M.assignFallbackBooster(last, gm, line[0], M.getUnassignedBoosters(last)[0]);
M.assignFallbackBooster(last, gm, line[1], M.getUnassignedBoosters(last)[0]);

eq("Giờ chỉ còn một đội chưa có Booster", M.isFinalTeamRemaining(last), true);
const lastBooster = M.getUnassignedBoosters(last)[0];
eq("Món cuối = nửa quỹ", M.getFallbackPrice(last, line[2], lastBooster), Math.floor(lf * 0.5));

const before2 = last.teams[line[2]].currentEnergy;
M.assignFallbackBooster(last, gm, line[2], lastBooster);
eq("Trừ đúng nửa quỹ", last.teams[line[2]].currentEnergy, before2 - Math.floor(lf * 0.5));
eq("Bốn đội đủ Booster", T.every((t) => last.teams[t].boosterOwned !== null), true);
// Đội hết sạch Energy thì nhận Booster giá 0, kể cả khi là món cuối.
const broke = auctionReady([100, 100, 100, 100]);
broke.auction.teams.TEAM_4.auctionFund = 0;
broke.auction.teams.TEAM_4.energySnapshot = 0;
eq("Quỹ bằng 0 → giá 0", M.getFallbackPrice(broke, "TEAM_4", "ALPHA"), 0);



/* --- Care Team tự đặt tên đội --- */
const nm = createInitialGameData(100, () => "hash");
const t1s = { role: "CARE_TEAM" as const, teamId: "TEAM_1" as TeamId, name: "TEAM ALPHA" };
const t2s = { role: "CARE_TEAM" as const, teamId: "TEAM_2" as TeamId, name: "TEAM BETA" };

applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", name: "BIỆT ĐỘI SẤM SÉT" }, t1s);
eq("Đội tự đặt được tên mình trước giờ G", nm.teams.TEAM_1.name, "BIỆT ĐỘI SẤM SÉT");
eq("Ghi vào nhật ký kèm tên cũ", nm.auditLog[0].oldValue, "TEAM ALPHA");
eq("Người thao tác là chính đội đó", nm.auditLog[0].role, "CARE_TEAM");

refuses(
  "Không đặt tên hộ đội khác",
  () => applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", name: "PHÁ HOẠI" }, t2s),
  "quyền",
);
refuses(
  "Không tự đổi PIN của mình",
  () => applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", pin: "0000" }, t1s),
  "quyền",
);
refuses(
  "Không để tên rỗng",
  () => applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", name: "   " }, t1s),
  "luật",
);
eq("Tên vẫn nguyên sau các lần bị chặn", nm.teams.TEAM_1.name, "BIỆT ĐỘI SẤM SÉT");

// Mở nguồn Energy là chốt sổ tên đội.
M.openEnergy(nm, gm, { TEAM_1: 100, TEAM_2: 100, TEAM_3: 100, TEAM_4: 100 });
refuses(
  "Ván đã bắt đầu thì đội không tự đổi tên nữa",
  () => applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", name: "ĐỔI GIỮA CHỪNG" }, t1s),
  "quyền",
);
applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", name: "GM ĐỔI HỘ" }, gmSession);
eq("Nhưng Game Master vẫn đổi được", nm.teams.TEAM_1.name, "GM ĐỔI HỘ");
applyAction(nm, { type: "setTeamProfile", teamId: "TEAM_1", pin: "4321" }, gmSession);
eq("Và Game Master vẫn đổi được PIN", verifyPin("4321", nm.teams.TEAM_1.pinHash), true);



/* --- Đội cuối cùng luôn trả nửa quỹ, kể cả khi thắng qua đấu giá --- */
// 102 trừ 2 lượt đầu tư 1 điểm ở TT1/TT2 → snapshot đúng 100 như ví dụ BTC.
const fin = auctionReady([102, 102, 102, 102]);
eq("Energy chốt sổ 100", fin.auction.teams.TEAM_4.energySnapshot, 100);
eq("Quỹ đấu giá = 80% của 100", fin.auction.teams.TEAM_4.auctionFund, 80);

// Mỗi đội nhắm một Booster riêng: không lô nào phải đấu công khai.
M.submitSealedBids(fin, gm, "TEAM_1", { ALPHA: 30, BETA: 0, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(fin, gm, "TEAM_2", { ALPHA: 0, BETA: 25, GAMMA: 0, DELTA: 0 });
M.submitSealedBids(fin, gm, "TEAM_3", { ALPHA: 0, BETA: 0, GAMMA: 20, DELTA: 0 });
M.submitSealedBids(fin, gm, "TEAM_4", { ALPHA: 0, BETA: 0, GAMMA: 0, DELTA: 10 });
M.lockSealedAuction(fin, gm);
M.orderAuctionLots(fin, gm);
eq("Thứ tự theo tổng đặt", fin.auction.order, ["ALPHA", "BETA", "GAMMA", "DELTA"]);

M.awardLot(fin, gm, "ALPHA");
eq("Đội 1 trả đúng giá kín 30", fin.teams.TEAM_1.currentEnergy, fin.auction.teams.TEAM_1.energySnapshot - 30);
M.awardLot(fin, gm, "BETA");
eq("Đội 2 trả đúng giá kín 25", fin.teams.TEAM_2.currentEnergy, fin.auction.teams.TEAM_2.energySnapshot - 25);
M.awardLot(fin, gm, "GAMMA");
eq("Đội 3 trả đúng giá kín 20", fin.teams.TEAM_3.currentEnergy, fin.auction.teams.TEAM_3.energySnapshot - 20);

// Giờ chỉ còn TEAM_4 và lô DELTA — dù đã đặt kín 10, vẫn phải trả nửa quỹ.
eq("Chỉ còn một đội chưa có Booster", M.isFinalTeamRemaining(fin), true);
eq("Món cuối = 50% của quỹ 80 = 40, không phải giá kín 10", M.getLotAwardPrice(fin, "DELTA", "TEAM_4"), 40);
const snap4 = fin.auction.teams.TEAM_4.energySnapshot;
M.awardLot(fin, gm, "DELTA");
eq("Đội cuối bị trừ 40, không phải 10", fin.teams.TEAM_4.currentEnergy, snap4 - 40);
eq("Ghi đúng giá vào kết quả lô", fin.auction.lots.DELTA.winningPrice, 40);
eq("Bốn đội đủ Booster", T.every((t) => fin.teams[t].boosterOwned !== null), true);
eq("Đấu giá kết thúc", fin.auction.phase, "DONE");

console.log(`\n${pass} đạt / ${fail} lỗi`);
process.exit(fail > 0 ? 1 : 0);
