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
    <div className="min-h-dvh px-5 py-6 sm:px-10 sm:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold tracking-[0.35em] text-brand uppercase sm:text-sm">
            Make Your Move
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-5xl">
            SCOREBOARD
          </h1>
        </div>
        <SyncPill />
      </header>

      <ol className="space-y-3 sm:space-y-4">
        {ranking.map((team, index) => (
          <li
            key={team.id}
            className="relative overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/70"
          >
            <div
              className="absolute inset-y-0 left-0 opacity-15 transition-[width] duration-700"
              style={{
                width: `${(team.publishedEnergy / max) * 100}%`,
                background: team.color,
              }}
            />
            <div className="relative flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-6">
              <span className="tabular text-xl font-black text-ink-400 sm:text-3xl">
                {MEDALS[index]}
              </span>
              <span
                className="h-10 w-1.5 rounded-full sm:h-14 sm:w-2"
                style={{ background: team.color }}
              />
              <span className="flex-1 truncate text-xl font-black tracking-wide text-white sm:text-4xl">
                {team.name}
              </span>
              <span className="tabular text-3xl font-black text-brand sm:text-6xl">
                {team.publishedEnergy}
              </span>
              <span className="text-lg text-brand sm:text-3xl">⚡</span>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-center text-xs tracking-wider text-ink-400 uppercase">
        Điểm chỉ thay đổi khi Game Master bấm Publish
      </p>
    </div>
  );
}
