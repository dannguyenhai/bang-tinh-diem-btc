"use client";

import { useState } from "react";
import { Badge, Button, Card, Empty, NumberField, Stat } from "@/components/ui";
import {
  AUCTION_PHASE_LABEL,
  BOOSTER_IDS,
  BOOSTER_META,
  TEAM_IDS,
} from "@/lib/config";
import {
  getFallbackPrice,
  getMinNextBid,
  getUnassignedBoosters,
  getUnassignedTeams,
} from "@/lib/mutations";
import { getCurrentLotBooster, nextFallbackTeam } from "@/lib/selectors";
import { useGameStore } from "@/lib/store";
import type { BoosterId, SealedBids, TeamId } from "@/lib/types";

export function AuctionControl() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const phase = data.auction.phase;
  const tt2Done = ["RESULT_LOCKED", "PUBLISHED"].includes(
    data.challenges[2].status,
  );

  return (
    <div className="space-y-4">
      <Card
        title="Đấu giá Booster"
        subtitle="Diễn ra ngay sau TT2"
        right={<Badge tone="brand">{AUCTION_PHASE_LABEL[phase]}</Badge>}
      >
        {phase === "IDLE" && (
          <div className="space-y-3">
            <p className="text-sm text-ink-200">
              Chốt snapshot Energy sau TT2 để tính quỹ đấu giá (80% Energy hiện
              có).
            </p>
            {!tt2Done && (
              <p className="text-sm text-lose">
                Cần khóa kết quả TT2 trước khi mở đấu giá.
              </p>
            )}
            <Button
              full
              disabled={!tt2Done}
              onClick={() => dispatch({ type: "openSealedAuction" })}
            >
              Snapshot Energy & mở vòng đấu kín
            </Button>
          </div>
        )}

        {phase !== "IDLE" && <FundTable />}
      </Card>

      {phase === "SEALED_OPEN" && <SealedRound />}
      {phase === "SEALED_LOCKED" && <SealedMatrix showOrderButton />}
      {phase === "RUNNING" && (
        <>
          <PublicRound />
          <SealedMatrix />
        </>
      )}
      {phase === "FALLBACK" && (
        <>
          <FallbackRound />
          <SealedMatrix />
        </>
      )}
      {phase === "DONE" && <AuctionSummary />}

      {phase !== "IDLE" && phase !== "DONE" && (
        <Button
          full
          variant="danger"
          onClick={() => dispatch({ type: "closeAuction" })}
        >
          Kết thúc đấu giá thủ công
        </Button>
      )}
    </div>
  );
}

function FundTable() {
  const data = useGameStore((s) => s.data);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TEAM_IDS.map((id) => {
        const state = data.auction.teams[id];
        return (
          <div
            key={id}
            className="rounded-xl border border-ink-700 bg-ink-800/40 p-2.5"
            style={{ borderLeft: `3px solid ${data.teams[id].color}` }}
          >
            <p className="truncate text-[11px] font-bold text-ink-200">
              {data.teams[id].name}
            </p>
            <p className="tabular text-xl font-black text-brand">
              {state.auctionFund}
            </p>
            <p className="tabular text-[11px] text-ink-400">
              Snapshot {state.energySnapshot} · giữ lại{" "}
              {state.auctionReservedEnergy}
            </p>
            {data.teams[id].boosterOwned && (
              <p className="mt-1 text-[11px] font-bold text-win">
                {data.teams[id].boosterOwned}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SealedRound() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const missing = TEAM_IDS.filter((id) => !data.auction.teams[id].submitted);

  return (
    <Card
      title="Vòng 1 — Đấu giá kín"
      subtitle="Care Team tự gửi phiếu trên máy của đội, GM có thể nhập hộ."
    >
      <div className="grid gap-2.5 lg:grid-cols-2">
        {TEAM_IDS.map((id) => (
          <SealedRow key={id} teamId={id} />
        ))}
      </div>
      <Button
        full
        className="mt-3"
        disabled={missing.length > 0}
        onClick={() => dispatch({ type: "lockSealedAuction" })}
      >
        {missing.length > 0
          ? `Còn ${missing.length} đội chưa gửi phiếu`
          : "Khóa phiếu đấu giá kín"}
      </Button>
    </Card>
  );
}

function SealedRow({ teamId }: { teamId: TeamId }) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const state = data.auction.teams[teamId];
  const [bids, setBids] = useState<Record<BoosterId, string>>({
    ALPHA: "0",
    BETA: "0",
    GAMMA: "0",
    DELTA: "0",
  });

  const numeric = BOOSTER_IDS.reduce((acc, id) => {
    acc[id] = Number(bids[id] || 0);
    return acc;
  }, {} as SealedBids);
  const total = BOOSTER_IDS.reduce((sum, id) => sum + numeric[id], 0);

  return (
    <div
      className="rounded-xl border border-ink-700 bg-ink-800/40 p-3"
      style={{ borderLeft: `3px solid ${data.teams[teamId].color}` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-white">{data.teams[teamId].name}</p>
        {state.submitted ? (
          <Badge tone="win">Đã gửi</Badge>
        ) : (
          <Badge tone="neutral">Chưa gửi</Badge>
        )}
      </div>

      {state.submitted ? (
        <p className="tabular mt-1.5 text-xs text-ink-400">
          Phiếu đã niêm phong — xem sau khi khóa vòng.
        </p>
      ) : (
        <div className="mt-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {BOOSTER_IDS.map((id) => (
              <NumberField
                key={id}
                label={id}
                value={bids[id]}
                onChange={(e) =>
                  setBids((prev) => ({
                    ...prev,
                    [id]: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="tabular flex-1 text-xs text-ink-400">
              Tổng {total} / quỹ {state.auctionFund}
            </span>
            <Button
              variant="subtle"
              disabled={total > state.auctionFund}
              onClick={() =>
                dispatch({ type: "submitSealedBids", teamId, bids: numeric })
              }
            >
              Gửi hộ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SealedMatrix({ showOrderButton = false }: { showOrderButton?: boolean }) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);

  return (
    <Card title="Ma trận giá kín" subtitle="Chỉ Game Master nhìn thấy bảng này.">
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-105 text-sm">
          <thead>
            <tr className="text-[10px] tracking-wider text-ink-400 uppercase">
              <th className="px-2 py-2 text-left">Đội</th>
              {BOOSTER_IDS.map((id) => (
                <th key={id} className="px-2 py-2 text-right">
                  {id}
                </th>
              ))}
              <th className="px-2 py-2 text-right">Quỹ</th>
            </tr>
          </thead>
          <tbody>
            {TEAM_IDS.map((teamId) => (
              <tr key={teamId} className="border-t border-ink-700">
                <td className="px-2 py-2 font-bold text-white">
                  {data.teams[teamId].name}
                </td>
                {BOOSTER_IDS.map((booster) => {
                  const value = data.auction.teams[teamId].bids[booster];
                  const won = data.auction.lots[booster].winner === teamId;
                  return (
                    <td
                      key={booster}
                      className={`px-2 py-2 text-right font-bold ${
                        won
                          ? "text-brand"
                          : value > 0
                            ? "text-white"
                            : "text-ink-400"
                      }`}
                    >
                      {value}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right text-ink-200">
                  {data.auction.teams[teamId].auctionFund}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showOrderButton && (
        <Button
          full
          className="mt-3"
          onClick={() => dispatch({ type: "randomizeAuctionOrder" })}
        >
          Bốc thứ tự Booster & bắt đầu đấu công khai
        </Button>
      )}
    </Card>
  );
}

function PublicRound() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const booster = getCurrentLotBooster(data);
  const [amount, setAmount] = useState("");
  const [pickTeam, setPickTeam] = useState<TeamId | null>(null);

  if (!booster) return <Empty>Đã chạy hết thứ tự đấu giá.</Empty>;

  const lot = data.auction.lots[booster];
  const minNext = getMinNextBid(data, booster);

  return (
    <Card
      title={`Lô ${data.auction.currentLotIndex + 1}/${data.auction.order.length} — ${BOOSTER_META[booster].name}`}
      subtitle={`Thứ tự: ${data.auction.order.join(" → ")}`}
    >
      {lot.note && <p className="mb-3 text-xs text-brand">{lot.note}</p>}

      {lot.status === "TIE_BREAK" ? (
        <div className="space-y-2.5">
          <p className="text-sm text-ink-200">
            Hòa giá kín. Bốc thăm ngoài sân khấu rồi chọn {lot.tieSlots} đội vào
            vòng công khai:
          </p>
          {lot.tieCandidates.map((teamId) => (
            <Button
              key={teamId}
              full
              variant="ghost"
              onClick={() => dispatch({ type: "resolveTie", booster, teamId })}
            >
              {data.teams[teamId].name} ·{" "}
              {data.auction.teams[teamId].bids[booster]}
            </Button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Giá hiện tại" value={lot.currentBid} tone="brand" />
            <Stat
              label="Đội dẫn"
              value={
                lot.currentLeader ? data.teams[lot.currentLeader].name : "—"
              }
            />
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {lot.candidates.map((teamId) => (
              <div
                key={teamId}
                className="rounded-xl border border-ink-700 bg-ink-800/40 p-2.5"
                style={{ borderLeft: `3px solid ${data.teams[teamId].color}` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white">
                    {data.teams[teamId].name}
                  </p>
                  <span className="tabular text-xs text-ink-400">
                    Giá kín {data.auction.teams[teamId].bids[booster]} · quỹ{" "}
                    {data.auction.teams[teamId].auctionFund}
                  </span>
                </div>
                {lot.currentLeader === teamId ? (
                  <Badge tone="brand">Đang dẫn</Badge>
                ) : (
                  <div className="mt-2 flex items-end gap-2">
                    <NumberField
                      className="flex-1"
                      label={`Nâng giá (≥ ${minNext})`}
                      value={pickTeam === teamId ? amount : ""}
                      onFocus={() => setPickTeam(teamId)}
                      onChange={(e) => {
                        setPickTeam(teamId);
                        setAmount(e.target.value.replace(/[^\d]/g, ""));
                      }}
                    />
                    <Button
                      variant="subtle"
                      disabled={pickTeam !== teamId || !amount}
                      onClick={async () => {
                        const ok = await dispatch({
                          type: "placePublicBid",
                          booster,
                          teamId,
                          amount: Number(amount),
                        });
                        if (ok) {
                          setAmount("");
                          setPickTeam(null);
                        }
                      }}
                    >
                      Chốt giá
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2 lg:mx-auto lg:max-w-xl">
            {lot.currentLeader ? (
              <Button
                full
                onClick={() => dispatch({ type: "awardLot", booster })}
              >
                Award Booster cho {data.teams[lot.currentLeader].name} ·{" "}
                {lot.currentBid}
              </Button>
            ) : (
              <>
                <p className="text-xs text-ink-400">
                  Hai đội bằng giá và chưa ai nâng — GM bốc thăm rồi trao:
                </p>
                {lot.candidates.map((teamId) => (
                  <Button
                    key={teamId}
                    full
                    variant="ghost"
                    onClick={() =>
                      dispatch({ type: "awardLot", booster, winner: teamId })
                    }
                  >
                    Trao cho {data.teams[teamId].name} · {lot.currentBid}
                  </Button>
                ))}
              </>
            )}
            <Button
              full
              variant="danger"
              onClick={() => dispatch({ type: "skipLot", booster })}
            >
              Bỏ qua lô này
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function FallbackRound() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const teamsLeft = getUnassignedTeams(data);
  const boostersLeft = getUnassignedBoosters(data);
  const turn = nextFallbackTeam(data);

  return (
    <Card
      title="Phân bổ Booster còn lại"
      subtitle="Bốc thăm thứ tự, mỗi đội chọn 1 Booster còn lại."
    >
      <p className="mb-3 text-sm text-ink-200">
        Còn {teamsLeft.length} đội chưa có Booster / {boostersLeft.length}{" "}
        Booster chưa có chủ.
      </p>

      {data.auction.fallbackOrder.length === 0 ? (
        <Button
          full
          onClick={() => dispatch({ type: "randomizeFallbackOrder" })}
        >
          Bốc thăm thứ tự chọn
        </Button>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-400">
            Thứ tự:{" "}
            {data.auction.fallbackOrder
              .map((id) => data.teams[id].name)
              .join(" → ")}
          </p>
          {turn ? (
            <div className="space-y-2">
              <Badge tone="brand">Đến lượt {data.teams[turn].name}</Badge>
              {boostersLeft.map((booster) => (
                <Button
                  key={booster}
                  full
                  variant="ghost"
                  onClick={() =>
                    dispatch({
                      type: "assignFallbackBooster",
                      teamId: turn,
                      booster,
                    })
                  }
                >
                  {BOOSTER_META[booster].name} · trả{" "}
                  {getFallbackPrice(data, turn, booster)}
                </Button>
              ))}
            </div>
          ) : (
            <Empty>Tất cả đội đã có Booster.</Empty>
          )}
        </>
      )}
    </Card>
  );
}

function AuctionSummary() {
  const data = useGameStore((s) => s.data);
  return (
    <Card title="Kết quả đấu giá">
      <div className="space-y-2">
        {BOOSTER_IDS.map((booster) => {
          const lot = data.auction.lots[booster];
          return (
            <div
              key={booster}
              className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-800/40 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-bold text-white">
                  {BOOSTER_META[booster].name}
                </p>
                <p className="text-xs text-ink-400">
                  {lot.winner ? data.teams[lot.winner].name : "Không ai sở hữu"}
                </p>
              </div>
              <span className="tabular text-lg font-black text-brand">
                {lot.winningPrice ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
