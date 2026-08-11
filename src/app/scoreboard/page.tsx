"use client";

import { LoadingScreen, SyncPill } from "@/components/AppShell";
import { getRanking } from "@/lib/selectors";
import { useGameStore } from "@/lib/store";

const MEDALS = ["01", "02", "03", "04"];

export default function ScoreboardPage() {
  const hydrated = useGameStore((s) => s.hydrated);
  const data = useGameStore((s) => s.data);

  if (!hydrated) return <LoadingScreen message="Đang tải bảng điểm…" />;

  const ranking = getRanking(data);
  const max = Math.max(...ranking.map((t) => t.publishedEnergy), 1);

  return (
    <div className="mx-auto min-h-dvh max-w-[1600px] px-5 py-6 sm:px-10 sm:py-10 lg:px-16 lg:py-14">
      <header className="mb-8 flex items-start justify-between gap-4 lg:mb-12">
        <div>
          <p className="text-[11px] font-bold tracking-[0.35em] text-brand uppercase sm:text-sm lg:text-base">
            Make Your Move
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">
            SCOREBOARD
          </h1>
        </div>
        <SyncPill />
      </header>

      <ol className="space-y-3 sm:space-y-4 lg:space-y-5">
        {ranking.map((team, index) => (
          <li
            key={team.id}
            style={{ "--stagger": index } as React.CSSProperties}
            className="enter relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/70"
          >
            {/* Thanh nền dài theo điểm — chuyển mượt khi GM bấm Publish. */}
            <div
              className="absolute inset-y-0 left-0 opacity-15 transition-[width] duration-500 ease-out"
              style={{
                width: `${(team.publishedEnergy / max) * 100}%`,
                background: team.color,
              }}
            />
            <div className="relative flex items-center gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:gap-8 lg:px-10 lg:py-8">
              <span className="tabular text-xl font-black text-ink-400 sm:text-3xl lg:text-5xl">
                {MEDALS[index]}
              </span>
              <span
                className="h-10 w-1.5 rounded-full sm:h-14 sm:w-2 lg:h-20 lg:w-2.5"
                style={{ background: team.color }}
              />
              <span className="flex-1 truncate text-xl font-black tracking-wide text-white sm:text-4xl lg:text-6xl">
                {team.name}
              </span>
              <span
                key={team.publishedEnergy}
                className="value-pop tabular text-3xl font-black text-brand sm:text-6xl lg:text-8xl"
              >
                {team.publishedEnergy}
              </span>
              <span className="text-lg text-brand sm:text-3xl lg:text-5xl">
                ⚡
              </span>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-center text-xs tracking-wider text-ink-400 uppercase lg:mt-12 lg:text-sm">
        Điểm chỉ thay đổi khi Game Master bấm Publish
      </p>
    </div>
  );
}
