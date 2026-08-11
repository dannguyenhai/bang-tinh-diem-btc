"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, GuardMessage, LoadingScreen } from "@/components/AppShell";
import { Breakdown } from "@/components/Breakdown";
import { Badge, Button, Card, Empty, NumberField, Stat } from "@/components/ui";
import {
  AUCTION_PHASE_LABEL,
  BOOSTER_IDS,
  BOOSTER_META,
  CHALLENGES,
  CHALLENGE_STATUS_LABEL,
} from "@/lib/config";
import { getMaxInvestment, validateInvestment } from "@/lib/engine";
import {
  getBoosterResponseTeams,
  getFallbackPrice,
  getMinNextBid,
  projectEntry,
} from "@/lib/mutations";
import {
  getActiveChallengeId,
  getCurrentLotBooster,
  isAuctionActive,
  nextFallbackTeam,
} from "@/lib/selectors";
import { useGameStore } from "@/lib/store";
import type { BoosterId, ChallengeId, SealedBids, TeamId } from "@/lib/types";

export default function TeamPage() {
  const hydrated = useGameStore((s) => s.hydrated);
  const session = useGameStore((s) => s.session);
  const data = useGameStore((s) => s.data);

  if (!hydrated) return <LoadingScreen />;
  if (!session || session.role !== "CARE_TEAM" || !session.teamId) {
    return (
      <GuardMessage title="Bạn cần đăng nhập bằng tài khoản Care Team">
        <p className="max-w-xs text-sm text-ink-400">
          Mỗi Care Team chỉ xem được dữ liệu của đội mình.
        </p>
      </GuardMessage>
    );
  }

  const teamId = session.teamId;
  const team = data.teams[teamId];
  const activeChallengeId = getActiveChallengeId(data);

  return (
    <AppShell title={team.name} subtitle="Care Team" accent={team.color}>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Energy hiện tại" value={team.currentEnergy} tone="brand" />
        <Stat label="Đã công bố" value={team.publishedEnergy} tone="muted" />
      </div>

      <BoosterCard teamId={teamId} />

      {isAuctionActive(data) && <AuctionSection teamId={teamId} />}

      {activeChallengeId !== null ? (
        <ChallengeSection teamId={teamId} challengeId={activeChallengeId} />
      ) : (
        !isAuctionActive(data) && (
          <Card title="Trạng thái">
            <Empty>
              Đang chờ Game Master mở vòng tiếp theo. Màn hình sẽ tự cập nhật.
            </Empty>
          </Card>
        )
      )}
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

function BoosterCard({ teamId }: { teamId: TeamId }) {
  const team = useGameStore((s) => s.data.teams[teamId]);
  if (!team.boosterOwned) {
    return (
      <Card title="Booster">
        <Empty>Đội chưa sở hữu Booster nào.</Empty>
      </Card>
    );
  }
  const meta = BOOSTER_META[team.boosterOwned];
  return (
    <Card
      title="Booster của đội"
      right={
        team.boosterUsed ? (
          <Badge tone="lose">Đã dùng</Badge>
        ) : (
          <Badge tone="win">Còn hiệu lực</Badge>
        )
      }
    >
      <p className="text-lg font-black text-brand">{meta.name}</p>
      <p className="mt-0.5 text-xs font-bold tracking-wider text-ink-400 uppercase">
        {meta.tagline}
      </p>
      <p className="mt-2 text-sm text-ink-200">{meta.description}</p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ChallengeSection({
  teamId,
  challengeId,
}: {
  teamId: TeamId;
  challengeId: ChallengeId;
}) {
  const data = useGameStore((s) => s.data);
  const challenge = data.challenges[challengeId];
  const config = CHALLENGES[challengeId];
  const entry = challenge.entries[teamId];
  const team = data.teams[teamId];

  return (
    <Card
      title={config.name}
      subtitle={config.participantType}
      right={<Badge tone="info">{CHALLENGE_STATUS_LABEL[challenge.status]}</Badge>}
    >
      <div className="mb-3 flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5">
        <span className="text-[11px] font-bold tracking-[0.14em] text-ink-200 uppercase">
          Reward
        </span>
        <span className="tabular text-xl font-black text-brand">
          {config.baseReward} Energy
        </span>
      </div>

      {challenge.status === "OPEN_FOR_INVESTMENT" && (
        <InvestmentForm teamId={teamId} challengeId={challengeId} />
      )}

      {challenge.status === "PRE_GAME_LOCKED" && (
        <div className="space-y-2">
          <Badge tone="brand">Đã khóa — không sửa được nữa</Badge>
          {config.investmentEnabled && (
            <p className="text-sm text-ink-200">
              Investment đã gửi:{" "}
              <span className="tabular font-black text-white">
                {entry.investment ?? 0}
              </span>
              {entry.preBoosterActivation && team.boosterOwned && (
                <span className="ml-2 text-brand">
                  · Kích hoạt {team.boosterOwned}
                </span>
              )}
            </p>
          )}
          <p className="text-sm text-ink-400">
            Thử thách đang diễn ra. Chờ Game Master nhập kết quả.
          </p>
        </div>
      )}

      {challenge.status === "RESULT_ENTRY" && (
        <p className="text-sm text-ink-400">
          Game Master đang nhập kết quả. Đợi một chút nhé.
        </p>
      )}

      {challenge.status === "BOOSTER_RESPONSE" && (
        <BoosterResponsePanel teamId={teamId} challengeId={challengeId} />
      )}

      {(challenge.status === "GM_REVIEW" ||
        challenge.status === "RESULT_LOCKED") && (
        <ResultSummary teamId={teamId} challengeId={challengeId} />
      )}
    </Card>
  );
}

function InvestmentForm({
  teamId,
  challengeId,
}: {
  teamId: TeamId;
  challengeId: ChallengeId;
}) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const config = CHALLENGES[challengeId];
  const entry = data.challenges[challengeId].entries[teamId];
  const team = data.teams[teamId];
  const energyBefore = entry.energyBefore ?? team.currentEnergy;
  const maxInvestment = getMaxInvestment(energyBefore);

  const canPreActivate =
    config.boosterEnabled &&
    !team.boosterUsed &&
    (team.boosterOwned === "ALPHA" || team.boosterOwned === "GAMMA");

  const [value, setValue] = useState(String(entry.investment ?? ""));
  const [activate, setActivate] = useState(entry.preBoosterActivation);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry.investmentSubmitted) {
      setValue(String(entry.investment ?? ""));
      setActivate(entry.preBoosterActivation);
    }
  }, [entry.investmentSubmitted, entry.investment, entry.preBoosterActivation]);

  const parsed = Number(value);
  const check = validateInvestment(
    Number.isNaN(parsed) ? -1 : parsed,
    energyBefore,
  );

  if (entry.investmentSubmitted) {
    return (
      <div className="space-y-3">
        <Badge tone="win">Đã gửi — chờ GM khóa</Badge>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Investment" value={entry.investment ?? 0} />
          <Stat
            label="Booster"
            value={
              entry.preBoosterActivation && team.boosterOwned
                ? team.boosterOwned
                : "—"
            }
          />
        </div>
        <p className="text-xs text-ink-400">
          Sau khi gửi, chỉ Game Master mới điều chỉnh được.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        await dispatch({
          type: "submitInvestment",
          teamId,
          challengeId,
          investment: parsed,
          preBoosterActivation: activate,
        });
        setSaving(false);
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Energy hiện tại" value={energyBefore} />
        <Stat label="Đầu tư tối đa" value={maxInvestment} tone="brand" />
      </div>

      <NumberField
        label="Investment"
        value={value}
        min={0}
        max={maxInvestment}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
        hint={
          value && !check.ok ? (
            <span className="text-lose">{check.message}</span>
          ) : (
            `Nhập số nguyên từ ${maxInvestment > 0 ? 1 : 0} đến ${maxInvestment}.`
          )
        }
      />

      {canPreActivate && team.boosterOwned && (
        <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-sm font-bold text-brand">
            {BOOSTER_META[team.boosterOwned].name}
          </p>
          <p className="mt-1 mb-3 text-xs text-ink-200">
            {BOOSTER_META[team.boosterOwned].description}
          </p>
          <p className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-400 uppercase">
            Kích hoạt Booster ngay vòng này?
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={activate ? "win" : "ghost"}
              onClick={() => setActivate(true)}
            >
              Có
            </Button>
            <Button
              type="button"
              variant={!activate ? "lose" : "ghost"}
              onClick={() => setActivate(false)}
            >
              Không
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Đã kích hoạt là tính đã dùng, dù thắng hay thua.
          </p>
        </div>
      )}

      <Button type="submit" full disabled={!check.ok || saving}>
        {saving ? "Đang gửi…" : "Gửi Investment"}
      </Button>
    </form>
  );
}

function BoosterResponsePanel({
  teamId,
  challengeId,
}: {
  teamId: TeamId;
  challengeId: ChallengeId;
}) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const entry = data.challenges[challengeId].entries[teamId];
  const team = data.teams[teamId];
  const eligible = getBoosterResponseTeams(data, challengeId).includes(teamId);

  if (entry.result === "WIN") {
    return (
      <div className="space-y-2">
        <Badge tone="win">Kết quả: CHIẾN THẮNG</Badge>
        <p className="text-sm text-ink-400">
          Chờ các đội khác quyết định Booster.
        </p>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="space-y-2">
        <Badge tone="lose">Kết quả: KHÔNG CHIẾN THẮNG</Badge>
        <p className="text-sm text-ink-400">
          {team.boosterOwned === "DELTA"
            ? "Delta chưa đủ điều kiện (Energy sau khi thua phải ≤ 80)."
            : "Đội không có Booster phòng thủ để dùng ở lượt này."}
        </p>
      </div>
    );
  }

  const decided = entry.reactiveBoosterActivation !== null;
  const meta = BOOSTER_META[team.boosterOwned as BoosterId];

  return (
    <div className="space-y-3">
      <Badge tone="lose">Kết quả: KHÔNG CHIẾN THẮNG</Badge>
      <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
        <p className="text-sm font-bold text-brand">{meta.name}</p>
        <p className="mt-1 text-xs text-ink-200">{meta.description}</p>
      </div>

      {decided ? (
        <Badge tone={entry.reactiveBoosterActivation ? "win" : "neutral"}>
          {entry.reactiveBoosterActivation
            ? "Đã chọn: DÙNG BOOSTER"
            : "Đã chọn: GIỮ LẠI"}
        </Badge>
      ) : (
        <div className="grid gap-2">
          <Button
            onClick={() =>
              dispatch({
                type: "setReactiveBooster",
                teamId,
                challengeId,
                use: true,
              })
            }
          >
            Dùng Booster
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              dispatch({
                type: "setReactiveBooster",
                teamId,
                challengeId,
                use: false,
              })
            }
          >
            Giữ cho vòng sau
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultSummary({
  teamId,
  challengeId,
}: {
  teamId: TeamId;
  challengeId: ChallengeId;
}) {
  const data = useGameStore((s) => s.data);
  const entry = data.challenges[challengeId].entries[teamId];
  const status = data.challenges[challengeId].status;

  if (entry.result === null) return <Empty>Chưa có kết quả.</Empty>;

  const projection = projectEntry(data, challengeId, teamId);
  if (!projection) return <Empty>Chưa có kết quả.</Empty>;

  return (
    <div className="space-y-3">
      <Badge tone={entry.result === "WIN" ? "win" : "lose"}>
        {entry.result === "WIN" ? "CHIẾN THẮNG" : "KHÔNG CHIẾN THẮNG"}
      </Badge>
      <Breakdown lines={projection.breakdown} />
      {status !== "RESULT_LOCKED" && (
        <p className="text-xs text-ink-400">
          Số liệu tạm tính — chỉ chính thức khi Game Master khóa kết quả.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AuctionSection({ teamId }: { teamId: TeamId }) {
  const data = useGameStore((s) => s.data);
  const phase = data.auction.phase;

  return (
    <Card
      title="Đấu giá Booster"
      right={<Badge tone="brand">{AUCTION_PHASE_LABEL[phase]}</Badge>}
    >
      {phase === "SEALED_OPEN" && <SealedBidForm teamId={teamId} />}
      {phase === "SEALED_LOCKED" && (
        <p className="text-sm text-ink-400">
          Phiếu kín đã khóa. Chờ Game Master bốc thứ tự Booster.
        </p>
      )}
      {phase === "RUNNING" && <PublicAuctionPanel teamId={teamId} />}
      {phase === "FALLBACK" && <FallbackPanel teamId={teamId} />}
    </Card>
  );
}

function SealedBidForm({ teamId }: { teamId: TeamId }) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const state = data.auction.teams[teamId];

  const [bids, setBids] = useState<Record<BoosterId, string>>({
    ALPHA: "0",
    BETA: "0",
    GAMMA: "0",
    DELTA: "0",
  });
  const [saving, setSaving] = useState(false);

  const numeric = useMemo(
    () =>
      BOOSTER_IDS.reduce((acc, id) => {
        acc[id] = Number(bids[id] || 0);
        return acc;
      }, {} as SealedBids),
    [bids],
  );
  const total = BOOSTER_IDS.reduce((sum, id) => sum + numeric[id], 0);
  const overFund = total > state.auctionFund;
  const allZero = state.auctionFund > 0 && total === 0;

  if (state.submitted) {
    return (
      <div className="space-y-3">
        <Badge tone="win">Đã gửi phiếu kín</Badge>
        <div className="grid grid-cols-2 gap-2.5">
          {BOOSTER_IDS.map((id) => (
            <Stat key={id} label={id} value={state.bids[id]} />
          ))}
        </div>
        <p className="text-xs text-ink-400">
          Giá kín chưa bị trừ Energy. Chỉ đội thắng mới phải trả.
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        await dispatch({ type: "submitSealedBids", teamId, bids: numeric });
        setSaving(false);
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Energy chốt sổ" value={state.energySnapshot} />
        <Stat label="Quỹ đấu giá" value={state.auctionFund} tone="brand" />
      </div>
      <p className="text-xs text-ink-400">
        Quỹ = 80% Energy sau TT2. Tổng 4 giá không vượt quỹ; không cần dùng hết.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        {BOOSTER_IDS.map((id) => (
          <NumberField
            key={id}
            label={BOOSTER_META[id].name.split(" — ")[0]}
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

      <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-800/50 px-3 py-2.5">
        <span className="text-[11px] font-bold tracking-[0.14em] text-ink-400 uppercase">
          Tổng đặt
        </span>
        <span
          className={`tabular text-xl font-black ${overFund ? "text-lose" : "text-white"}`}
        >
          {total} / {state.auctionFund}
        </span>
      </div>

      {allZero && (
        <p className="text-xs text-lose">
          Phải đặt giá &gt; 0 cho ít nhất một Booster.
        </p>
      )}

      <Button type="submit" full disabled={overFund || allZero || saving}>
        {saving ? "Đang gửi…" : "Gửi phiếu kín"}
      </Button>
      <p className="text-xs text-ink-400">
        Sau khi gửi không sửa được. Các đội khác không nhìn thấy giá của bạn.
      </p>
    </form>
  );
}

function PublicAuctionPanel({ teamId }: { teamId: TeamId }) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const booster = getCurrentLotBooster(data);
  const [amount, setAmount] = useState("");

  if (!booster) return <Empty>Đang chuyển lô đấu giá…</Empty>;

  const lot = data.auction.lots[booster];
  const fund = data.auction.teams[teamId].auctionFund;
  const inRound = lot.candidates.includes(teamId);
  const minNext = getMinNextBid(data, booster);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-brand/40 bg-brand/5 p-3">
        <p className="text-xs font-bold tracking-[0.14em] text-ink-400 uppercase">
          Đang đấu
        </p>
        <p className="text-lg font-black text-brand">
          {BOOSTER_META[booster].name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Giá hiện tại" value={lot.currentBid} tone="brand" />
        <Stat
          label="Đội đang dẫn"
          value={lot.currentLeader ? data.teams[lot.currentLeader].name : "—"}
        />
      </div>

      {lot.note && <p className="text-xs text-ink-400">{lot.note}</p>}

      {lot.status === "TIE_BREAK" && (
        <p className="text-sm text-ink-200">
          Đang chờ Game Master xử lý trường hợp hòa giá kín.
        </p>
      )}

      {lot.status === "PUBLIC" &&
        (inRound ? (
          lot.currentLeader === teamId ? (
            <Badge tone="win">Đội bạn đang dẫn giá</Badge>
          ) : (
            <div className="space-y-2">
              <NumberField
                label={`Nâng giá (tối thiểu ${minNext})`}
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d]/g, ""))
                }
                hint={`Trần theo quỹ của đội: ${fund}`}
              />
              <Button
                full
                disabled={
                  !amount || Number(amount) < minNext || Number(amount) > fund
                }
                onClick={async () => {
                  const ok = await dispatch({
                    type: "placePublicBid",
                    booster,
                    teamId,
                    amount: Number(amount),
                  });
                  if (ok) setAmount("");
                }}
              >
                Nâng giá
              </Button>
            </div>
          )
        ) : (
          <p className="text-sm text-ink-400">
            Đội bạn không nằm trong Top 2 của lô này.
          </p>
        ))}
    </div>
  );
}

function FallbackPanel({ teamId }: { teamId: TeamId }) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const team = data.teams[teamId];
  const turn = nextFallbackTeam(data);
  const remaining = BOOSTER_IDS.filter(
    (b) => data.auction.lots[b].status !== "AWARDED",
  );

  if (team.boosterOwned) {
    return (
      <p className="text-sm text-ink-400">
        Đội đã có Booster. Chờ các đội còn lại chọn xong.
      </p>
    );
  }

  if (data.auction.fallbackOrder.length === 0) {
    return (
      <p className="text-sm text-ink-400">
        Chờ Game Master bốc thăm thứ tự chọn Booster.
      </p>
    );
  }

  if (turn !== teamId) {
    return (
      <p className="text-sm text-ink-400">
        Đến lượt {turn ? data.teams[turn].name : "—"} chọn trước.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <Badge tone="brand">Đến lượt đội bạn chọn Booster</Badge>
      {remaining.map((booster) => (
        <button
          key={booster}
          onClick={() =>
            dispatch({ type: "assignFallbackBooster", teamId, booster })
          }
          className="flex w-full items-center justify-between rounded-xl border border-ink-600 bg-ink-800/60 px-4 py-3 text-left hover:border-brand"
        >
          <span>
            <span className="block text-sm font-bold text-white">
              {BOOSTER_META[booster].name}
            </span>
            <span className="block text-xs text-ink-400">
              {BOOSTER_META[booster].tagline}
            </span>
          </span>
          <span className="tabular text-lg font-black text-brand">
            {getFallbackPrice(data, teamId, booster)}
          </span>
        </button>
      ))}
    </div>
  );
}
