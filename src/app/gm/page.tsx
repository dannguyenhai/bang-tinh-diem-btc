"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, GuardMessage, LoadingScreen } from "@/components/AppShell";
import { AuctionControl } from "@/components/gm/AuctionControl";
import { AuditLogPanel } from "@/components/gm/AuditLogPanel";
import { ChallengeControl } from "@/components/gm/ChallengeControl";
import { TeamsAdmin } from "@/components/gm/TeamsAdmin";
import { Badge, Button } from "@/components/ui";
import { TEAM_IDS } from "@/lib/config";
import { hasPendingPublish, hasUnpublishedChanges } from "@/lib/selectors";
import { useGameStore } from "@/lib/store";

const TABS = [
  { id: "challenge", label: "Điều hành" },
  { id: "auction", label: "Đấu giá" },
  { id: "teams", label: "Đội & PIN" },
  { id: "audit", label: "Nhật ký" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GmPage() {
  const hydrated = useGameStore((s) => s.hydrated);
  const session = useGameStore((s) => s.session);
  const [tab, setTab] = useState<TabId>("challenge");

  if (!hydrated) return <LoadingScreen />;
  if (!session || session.role !== "GM") {
    return (
      <GuardMessage title="Khu vực dành cho Game Master">
        <p className="max-w-xs text-sm text-ink-400">
          Đăng nhập bằng PIN của Game Master để điều hành ván chơi.
        </p>
      </GuardMessage>
    );
  }

  return (
    <AppShell title="GAME MASTER" subtitle="Bảng điều hành" wide>
      <ScoreStrip />

      <nav className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] sm:px-5 sm:text-sm ${
              tab === item.id
                ? "bg-linear-to-b from-neon-soft to-neon text-ink-950 shadow-[0_0_20px_-6px_var(--color-neon)]"
                : "border border-ink-700 bg-ink-900/70 text-ink-200 hover:border-neon hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "challenge" && <ChallengeControl />}
      {tab === "auction" && <AuctionControl />}
      {tab === "teams" && <TeamsAdmin />}
      {tab === "audit" && <AuditLogPanel />}
    </AppShell>
  );
}

function ScoreStrip() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const pending = hasPendingPublish(data);
  const energyChanged = hasUnpublishedChanges(data);

  return (
    <section className="enter glow-soft rounded-2xl border border-ink-700/80 bg-linear-to-b from-ink-900/90 to-ink-950/80 p-3 backdrop-blur sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-ink-200 uppercase">
          <span className="inline-block h-3.5 w-0.5 bg-neon shadow-[0_0_8px_var(--color-neon)]" />
          Energy nội bộ / đã công bố
        </h2>
        <Link
          href="/scoreboard"
          target="_blank"
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-[10px] font-bold tracking-wider text-ink-200 uppercase transition-colors duration-150 ease-out hover:border-neon hover:text-neon"
        >
          Mở LED
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEAM_IDS.map((id, index) => {
          const team = data.teams[id];
          const diff = team.currentEnergy - team.publishedEnergy;
          return (
            <div
              key={id}
              style={{ "--stagger": index } as React.CSSProperties}
              className="enter relative rounded-lg border border-ink-700 bg-linear-to-b from-ink-800/60 to-ink-950/60 p-2.5"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.5"
                style={{
                  background: team.color,
                  boxShadow: `0 0 12px ${team.color}`,
                }}
              />
              <p className="mt-1 truncate text-[11px] font-bold text-ink-200 sm:text-xs">
                {team.name}
              </p>
              {/* key đổi theo giá trị → nhịp phóng nhẹ báo Energy vừa được chốt */}
              <p
                key={team.currentEnergy}
                className="value-pop tabular text-2xl font-black text-white sm:text-3xl"
              >
                {team.currentEnergy}
              </p>
              <p className="tabular text-[11px] text-ink-400">
                LED: {team.publishedEnergy}
                {diff !== 0 && (
                  <span className={diff > 0 ? "text-win" : "text-lose"}>
                    {" "}
                    ({diff > 0 ? "+" : ""}
                    {diff})
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Button
          full
          className="sm:max-w-xs"
          disabled={!pending}
          onClick={() => dispatch({ type: "publishScoreboard" })}
        >
          Publish Scoreboard
        </Button>
        <div className="flex justify-center sm:justify-start">
          {energyChanged ? (
            <Badge tone="brand">Có thay đổi chưa công bố</Badge>
          ) : pending ? (
            <Badge tone="info">Còn vòng chưa công bố</Badge>
          ) : (
            <Badge tone="win">LED đang khớp</Badge>
          )}
        </div>
      </div>
    </section>
  );
}
