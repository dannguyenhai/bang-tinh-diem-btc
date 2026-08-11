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
import { hasUnpublishedChanges } from "@/lib/selectors";
import { useGameStore } from "@/lib/store";

const TABS = [
  { id: "challenge", label: "Điều hành" },
  { id: "auction", label: "Đấu giá" },
  { id: "teams", label: "Đội" },
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
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition-colors ${
              tab === item.id
                ? "bg-brand text-ink-950"
                : "border border-ink-700 bg-ink-900 text-ink-200 hover:border-brand"
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
  const pending = hasUnpublishedChanges(data);

  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900/80 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold tracking-[0.14em] text-ink-200 uppercase">
          Energy nội bộ / đã công bố
        </h2>
        <Link
          href="/scoreboard"
          target="_blank"
          className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-[10px] font-bold text-ink-200 uppercase hover:border-info hover:text-info"
        >
          Mở LED
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEAM_IDS.map((id) => {
          const team = data.teams[id];
          const diff = team.currentEnergy - team.publishedEnergy;
          return (
            <div
              key={id}
              className="rounded-xl border border-ink-700 bg-ink-800/50 p-2.5"
              style={{ borderLeft: `3px solid ${team.color}` }}
            >
              <p className="truncate text-[11px] font-bold text-ink-200">
                {team.name}
              </p>
              <p className="tabular text-2xl font-black text-white">
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

      <div className="mt-3 flex items-center gap-2">
        <Button
          full
          disabled={!pending}
          onClick={() => dispatch({ type: "publishScoreboard" })}
        >
          Publish Scoreboard
        </Button>
        {pending ? (
          <Badge tone="brand">Có thay đổi chưa công bố</Badge>
        ) : (
          <Badge tone="win">LED đang khớp</Badge>
        )}
      </div>
    </section>
  );
}
