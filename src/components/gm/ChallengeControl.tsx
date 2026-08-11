"use client";

import { useState } from "react";
import { Breakdown } from "@/components/Breakdown";
import { Badge, Button, Card, Empty, NumberField, Stat } from "@/components/ui";
import {
  BOOSTER_META,
  CHALLENGES,
  CHALLENGE_IDS,
  CHALLENGE_STATUS_LABEL,
  TEAM_IDS,
} from "@/lib/config";
import { getMaxInvestment } from "@/lib/engine";
import { canReopen, getBoosterResponseTeams, projectEntry } from "@/lib/mutations";
import { getActiveChallengeId, getNextChallengeId } from "@/lib/selectors";
import { useGameStore } from "@/lib/store";
import type { ChallengeId, TeamId } from "@/lib/types";

export function ChallengeControl() {
  const data = useGameStore((s) => s.data);
  const activeId = getActiveChallengeId(data);
  const nextId = getNextChallengeId(data);

  return (
    <div className="space-y-4">
      {!data.energyOpened && <OpenEnergyForm />}

      <Card title="Tiến trình gameshow">
        <div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
            {CHALLENGE_IDS.map((id, index) => {
              const status = data.challenges[id].status;
              const done = status === "PUBLISHED" || status === "RESULT_LOCKED";
              const idle = status === "IDLE";
              const tone = done
                ? "border-win/50 bg-win/8 text-win"
                : idle
                  ? "border-ink-700 bg-ink-900/60 text-ink-400"
                  : "border-neon/60 bg-neon/10 text-neon shadow-[0_0_22px_-8px_var(--color-neon)]";
              return (
                <div
                  key={id}
                  style={{ "--stagger": index } as React.CSSProperties}
                  className={`enter rounded-lg border px-1 py-2.5 text-center transition-colors duration-200 ease-out sm:px-3 sm:py-3 ${tone}`}
                >
                  <div className="text-sm font-black sm:text-lg">
                    {CHALLENGES[id].shortName}
                  </div>
                  <div className="mt-0.5 text-[8px] leading-tight font-bold uppercase sm:text-[10px]">
                    {CHALLENGE_STATUS_LABEL[status]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {activeId !== null ? (
        <ChallengeDetail challengeId={activeId} />
      ) : nextId !== null ? (
        <Card title="Vòng tiếp theo">
          <p className="mb-3 text-sm text-ink-200">
            {CHALLENGES[nextId].name} — Reward {CHALLENGES[nextId].baseReward}{" "}
            Energy
          </p>
          <OpenChallengeButton challengeId={nextId} />
        </Card>
      ) : (
        <Card title="Kết thúc">
          <Empty>Đã hoàn tất cả 5 thử thách. Chốt Champion thôi!</Empty>
        </Card>
      )}
    </div>
  );
}

function OpenChallengeButton({ challengeId }: { challengeId: ChallengeId }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const energyOpened = useGameStore((s) => s.data.energyOpened);
  return (
    <Button
      full
      disabled={!energyOpened}
      onClick={() => dispatch({ type: "openChallenge", challengeId })}
    >
      Mở {CHALLENGES[challengeId].shortName}
    </Button>
  );
}

function OpenEnergyForm() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const [values, setValues] = useState<Record<TeamId, string>>(() => {
    const initial = {} as Record<TeamId, string>;
    for (const id of TEAM_IDS) initial[id] = String(data.teams[id].currentEnergy);
    return initial;
  });

  return (
    <Card
      title="Mở nguồn Energy"
      subtitle="Nhập Energy khởi đầu cho từng đội trước khi vào TT1."
    >
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {TEAM_IDS.map((id) => (
          <NumberField
            key={id}
            label={data.teams[id].name}
            value={values[id]}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                [id]: e.target.value.replace(/[^\d]/g, ""),
              }))
            }
          />
        ))}
      </div>
      <Button
        full
        className="mt-3"
        onClick={() => {
          const energies = {} as Record<TeamId, number>;
          for (const id of TEAM_IDS) energies[id] = Number(values[id] || 0);
          void dispatch({ type: "openEnergy", energies });
        }}
      >
        Công bố Energy khởi đầu
      </Button>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function ChallengeDetail({ challengeId }: { challengeId: ChallengeId }) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const config = CHALLENGES[challengeId];
  const challenge = data.challenges[challengeId];
  const status = challenge.status;
  const nextId = getNextChallengeId(data);
  const [reason, setReason] = useState("");

  const responseTeams = getBoosterResponseTeams(data, challengeId);
  const allResultsIn = TEAM_IDS.every(
    (id) => challenge.entries[id].result !== null,
  );

  return (
    <Card
      title={config.name}
      subtitle={`${config.participantType} · Reward ${config.baseReward}`}
      right={
        <Badge
          tone={
            status === "RESULT_LOCKED" || status === "PUBLISHED" ? "win" : "info"
          }
        >
          {CHALLENGE_STATUS_LABEL[status]}
        </Badge>
      }
    >
      <div className="grid gap-2.5 lg:grid-cols-2">
        {TEAM_IDS.map((teamId, index) => (
          <TeamRow
            key={teamId}
            teamId={teamId}
            challengeId={challengeId}
            index={index}
          />
        ))}
      </div>

      <div className="mt-4 space-y-2 lg:mx-auto lg:max-w-xl">
        {status === "OPEN_FOR_INVESTMENT" && (
          <Button
            full
            onClick={() => dispatch({ type: "lockInvestment", challengeId })}
          >
            Khóa Investment{config.boosterEnabled ? " & Pre-active Booster" : ""}
          </Button>
        )}

        {status === "PRE_GAME_LOCKED" && (
          <Button
            full
            onClick={() => dispatch({ type: "startResultEntry", challengeId })}
          >
            Mở nhập kết quả
          </Button>
        )}

        {status === "RESULT_ENTRY" && (
          <>
            {config.boosterEnabled && (
              <Button
                full
                disabled={!allResultsIn || responseTeams.length === 0}
                onClick={() =>
                  dispatch({ type: "openBoosterResponse", challengeId })
                }
              >
                Mở Booster Response
                {allResultsIn && responseTeams.length === 0
                  ? " (không đội nào đủ điều kiện)"
                  : ""}
              </Button>
            )}
            <Button
              full
              variant="ghost"
              disabled={!allResultsIn}
              onClick={() => dispatch({ type: "goToReview", challengeId })}
            >
              Chuyển sang soát kết quả
            </Button>
          </>
        )}

        {status === "BOOSTER_RESPONSE" && (
          <Button
            full
            onClick={() => dispatch({ type: "closeBoosterResponse", challengeId })}
          >
            Đóng Booster Response
          </Button>
        )}

        {status === "GM_REVIEW" && (
          <Button
            full
            onClick={() => dispatch({ type: "lockResult", challengeId })}
          >
            Khóa kết quả — chốt Energy
          </Button>
        )}

        {(status === "RESULT_LOCKED" || status === "PUBLISHED") &&
          nextId !== null && (
            <div className="space-y-2">
              <p className="text-center text-xs text-ink-400">
                Vòng này đã chốt Energy. Có thể mở vòng kế tiếp ngay, không cần
                chờ Publish.
              </p>
              <OpenChallengeButton challengeId={nextId} />
            </div>
          )}

        {status === "RESULT_LOCKED" && (
          <div className="space-y-2 rounded-lg border border-lose/30 bg-lose/5 p-3">
            <p className="text-xs text-ink-400">
              Cần sửa? Phải mở lại kèm lý do, hệ thống ghi vào nhật ký.
            </p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Lý do mở lại…"
              className="rounded-lg w-full border border-ink-600 bg-ink-950 px-3 py-2.5 text-sm text-white outline-none transition-colors duration-150 ease-out focus:border-neon"
            />
            <Button
              full
              variant="danger"
              disabled={!reason.trim() || !canReopen(data, challengeId)}
              onClick={async () => {
                const ok = await dispatch({
                  type: "reopenResult",
                  challengeId,
                  reason,
                });
                if (ok) setReason("");
              }}
            >
              Mở lại kết quả
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function TeamRow({
  teamId,
  challengeId,
  index = 0,
}: {
  teamId: TeamId;
  challengeId: ChallengeId;
  index?: number;
}) {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const config = CHALLENGES[challengeId];
  const challenge = data.challenges[challengeId];
  const entry = challenge.entries[teamId];
  const team = data.teams[teamId];
  const status = challenge.status;
  const energyBefore = entry.energyBefore ?? team.currentEnergy;

  const [draftInvestment, setDraftInvestment] = useState("");
  const [draftActivate, setDraftActivate] = useState(false);
  const projection = projectEntry(data, challengeId, teamId);
  const canRespond = getBoosterResponseTeams(data, challengeId).includes(teamId);

  // Alpha/Gamma phải chốt trước giờ thi đấu — GM nhập hộ cũng phải chốt được,
  // nếu không đội sẽ mất quyền dùng Booster chỉ vì không kịp tự nhập.
  const canPreActivate =
    config.boosterEnabled &&
    !team.boosterUsed &&
    (team.boosterOwned === "ALPHA" || team.boosterOwned === "GAMMA");

  return (
    <div
      className="enter rounded-lg border border-ink-700 bg-linear-to-b from-ink-800/50 to-ink-950/50 p-3"
      style={
        {
          borderLeft: `3px solid ${team.color}`,
          "--stagger": index,
        } as React.CSSProperties
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-white">{team.name}</p>
          <p className="tabular text-xs text-ink-400">
            Energy {energyBefore}
            {config.investmentEnabled &&
              ` · Trần đầu tư ${getMaxInvestment(energyBefore)}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {team.boosterOwned && (
            <Badge tone={team.boosterUsed ? "neutral" : "brand"}>
              {team.boosterOwned}
              {team.boosterUsed ? " (đã dùng)" : ""}
            </Badge>
          )}
          {entry.result && (
            <Badge tone={entry.result === "WIN" ? "win" : "lose"}>
              {entry.result}
            </Badge>
          )}
        </div>
      </div>

      {status === "OPEN_FOR_INVESTMENT" && config.investmentEnabled && (
        <div className="mt-2.5">
          {entry.investmentSubmitted ? (
            <p className="text-sm text-ink-200">
              Investment:{" "}
              <span className="tabular font-black text-white">
                {entry.investment}
              </span>
              {entry.preBoosterActivation && (
                <span className="ml-2 text-brand">
                  · kích hoạt {team.boosterOwned}
                </span>
              )}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <NumberField
                  className="flex-1"
                  label="Nhập hộ Investment"
                  value={draftInvestment}
                  onChange={(e) =>
                    setDraftInvestment(e.target.value.replace(/[^\d]/g, ""))
                  }
                />
                <Button
                  variant="subtle"
                  disabled={!draftInvestment}
                  onClick={async () => {
                    const ok = await dispatch({
                      type: "submitInvestment",
                      teamId,
                      challengeId,
                      investment: Number(draftInvestment),
                      preBoosterActivation: canPreActivate && draftActivate,
                    });
                    if (ok) {
                      setDraftInvestment("");
                      setDraftActivate(false);
                    }
                  }}
                >
                  Gửi
                </Button>
              </div>

              {canPreActivate && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold tracking-[0.14em] text-ink-400 uppercase">
                    Kích hoạt {team.boosterOwned}?
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      variant={draftActivate ? "win" : "ghost"}
                      className="px-3 py-1.5 text-[11px]"
                      onClick={() => setDraftActivate(true)}
                    >
                      Có
                    </Button>
                    <Button
                      variant={!draftActivate ? "lose" : "ghost"}
                      className="px-3 py-1.5 text-[11px]"
                      onClick={() => setDraftActivate(false)}
                    >
                      Không
                    </Button>
                  </div>
                </div>
              )}

              {config.boosterEnabled &&
                !team.boosterUsed &&
                (team.boosterOwned === "BETA" ||
                  team.boosterOwned === "DELTA") && (
                  <p className="text-[11px] text-ink-400">
                    {team.boosterOwned} chỉ quyết định sau khi đội thua — sẽ hỏi
                    ở bước Booster Response.
                  </p>
                )}
            </div>
          )}
        </div>
      )}

      {(status === "RESULT_ENTRY" ||
        status === "BOOSTER_RESPONSE" ||
        status === "GM_REVIEW") && (
        <>
          {config.investmentEnabled && (
            <p className="tabular mt-2 text-xs text-ink-400">
              Investment {entry.investment ?? 0}
              {entry.preBoosterActivation && ` · ${team.boosterOwned} kích hoạt`}
            </p>
          )}
          {status === "RESULT_ENTRY" && (
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <Button
                variant="win"
                active={entry.result === "WIN"}
                onClick={() =>
                  dispatch({
                    type: "setResult",
                    teamId,
                    challengeId,
                    result: "WIN",
                  })
                }
              >
                Win
              </Button>
              <Button
                variant="lose"
                active={entry.result === "LOSE"}
                onClick={() =>
                  dispatch({
                    type: "setResult",
                    teamId,
                    challengeId,
                    result: "LOSE",
                  })
                }
              >
                Lose
              </Button>
            </div>
          )}
        </>
      )}

      {status === "BOOSTER_RESPONSE" && canRespond && team.boosterOwned && (
        <div className="rounded-lg mt-2.5 border border-neon/40 bg-neon/5 p-2.5">
          <p className="mb-2 text-xs text-neon">
            {BOOSTER_META[team.boosterOwned].name} — chờ Captain quyết định
          </p>
          {entry.reactiveBoosterActivation === null ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="win"
                onClick={() =>
                  dispatch({
                    type: "setReactiveBooster",
                    teamId,
                    challengeId,
                    use: true,
                  })
                }
              >
                Use
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
                Keep
              </Button>
            </div>
          ) : (
            <Badge tone={entry.reactiveBoosterActivation ? "win" : "neutral"}>
              {entry.reactiveBoosterActivation ? "ĐÃ DÙNG" : "GIỮ LẠI"}
            </Badge>
          )}
        </div>
      )}

      {projection &&
        (status === "GM_REVIEW" ||
          status === "RESULT_LOCKED" ||
          status === "BOOSTER_RESPONSE") && (
          <div className="rounded-lg mt-3 border border-ink-700 bg-ink-950/70 p-3">
            <Breakdown lines={projection.breakdown} />
          </div>
        )}

      {status === "RESULT_LOCKED" && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Stat label="Trước vòng" value={entry.energyBefore ?? "—"} />
          <Stat label="Sau vòng" value={entry.energyAfter ?? "—"} tone="brand" />
        </div>
      )}
    </div>
  );
}
