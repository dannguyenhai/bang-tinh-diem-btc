"use client";

import { LoadingScreen, SyncPill } from "@/components/AppShell";
import { BOOSTER_META } from "@/lib/config";
import { getRanking } from "@/lib/selectors";
import { useGameStore } from "@/lib/store";

const RANKS = ["01", "02", "03", "04"];

export default function ScoreboardPage() {
  const hydrated = useGameStore((s) => s.hydrated);
  const data = useGameStore((s) => s.data);

  if (!hydrated) return <LoadingScreen message="Đang tải bảng điểm…" />;

  const ranking = getRanking(data);
  const max = Math.max(...ranking.map((t) => t.publishedEnergy), 1);

  return (
    <div className="hud-rings relative mx-auto min-h-dvh max-w-[1700px] px-5 py-7 sm:px-10 sm:py-10 lg:px-16 lg:py-12">
      <div className="absolute top-4 right-5 sm:top-6 sm:right-10">
        <SyncPill />
      </div>

      <header className="enter mb-8 text-center lg:mb-12">
        <h1 className="chrome chrome-sweep text-2xl leading-none font-black tracking-tight sm:text-4xl lg:text-6xl">
          MAKE YOUR MOVE
        </h1>
        <div className="mt-3 flex items-center justify-center gap-3 lg:mt-4">
          <span className="h-px w-10 bg-linear-to-r from-transparent to-neon sm:w-20 lg:w-32" />
          <p className="neon-text text-[10px] font-bold tracking-[0.4em] text-neon-soft uppercase sm:text-sm lg:text-base">
            Scoreboard
          </p>
          <span className="h-px w-10 bg-linear-to-l from-transparent to-neon sm:w-20 lg:w-32" />
        </div>
      </header>

      <ol className="space-y-3 sm:space-y-4 lg:space-y-5">
        {ranking.map((team, index) => {
          const leader = index === 0;
          return (
            <li
              key={team.id}
              style={{ "--stagger": index } as React.CSSProperties}
              className="enter relative"
            >
              {/* Viền vát góc mang màu đội */}
              <div
                className="clip-notch absolute inset-0"
                style={{
                  background: `linear-gradient(140deg, ${team.color} 0%, transparent 34%, transparent 66%, ${team.color} 100%)`,
                  opacity: leader ? 0.95 : 0.5,
                }}
              />
              <div className="clip-notch absolute inset-px bg-linear-to-r from-ink-900 via-ink-950 to-ink-900" />

              {/* Thanh nền dài theo điểm — chuyển mượt khi GM bấm Publish */}
              <div
                className="clip-notch absolute inset-px overflow-hidden"
                aria-hidden
              >
                <div
                  className="h-full transition-[width] duration-500 ease-out"
                  style={{
                    width: `${(team.publishedEnergy / max) * 100}%`,
                    background: `linear-gradient(90deg, ${team.color}38, ${team.color}08 70%, transparent)`,
                  }}
                />
              </div>

              <div className="relative flex items-center gap-4 px-5 py-4 sm:gap-7 sm:px-8 sm:py-6 lg:gap-10 lg:px-12 lg:py-8">
                <span
                  className="tabular text-xl font-black sm:text-3xl lg:text-5xl"
                  style={{
                    color: leader ? team.color : undefined,
                    textShadow: leader ? `0 0 20px ${team.color}` : undefined,
                  }}
                >
                  <span className={leader ? "" : "text-ink-600"}>
                    {RANKS[index]}
                  </span>
                </span>

                <span
                  className="h-10 w-1 shrink-0 sm:h-16 sm:w-1.5 lg:h-24 lg:w-2"
                  style={{
                    background: team.color,
                    boxShadow: `0 0 18px ${team.color}`,
                  }}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xl font-black tracking-wide text-white sm:text-4xl lg:text-6xl">
                    {team.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {leader && (
                      <span
                        className="text-[9px] font-bold tracking-[0.34em] uppercase sm:text-xs lg:text-sm"
                        style={{ color: team.color }}
                      >
                        Đang dẫn đầu
                      </span>
                    )}
                    {team.boosterOwned && (
                      <span
                        className="inline-flex items-center gap-1.5 border px-2 py-0.5 text-[9px] font-bold tracking-[0.22em] uppercase sm:gap-2 sm:px-3 sm:py-1 sm:text-sm lg:px-4 lg:py-1.5 lg:text-lg"
                        style={{
                          color: BOOSTER_META[team.boosterOwned].color,
                          borderColor: `${BOOSTER_META[team.boosterOwned].color}66`,
                          background: `${BOOSTER_META[team.boosterOwned].color}14`,
                          opacity: team.boosterUsed ? 0.6 : 1,
                        }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2 lg:h-2.5 lg:w-2.5"
                          style={{
                            background: BOOSTER_META[team.boosterOwned].color,
                            boxShadow: team.boosterUsed
                              ? undefined
                              : `0 0 8px ${BOOSTER_META[team.boosterOwned].color}`,
                          }}
                        />
                        {BOOSTER_META[team.boosterOwned].short}
                        {team.boosterUsed && " · đã dùng"}
                      </span>
                    )}
                  </span>
                </span>

                <span className="flex items-baseline gap-2 lg:gap-4">
                  <span
                    key={team.publishedEnergy}
                    className="value-pop tabular text-3xl font-black text-brand sm:text-6xl lg:text-8xl"
                    style={{ textShadow: "0 0 26px rgba(245,197,66,0.35)" }}
                  >
                    {team.publishedEnergy}
                  </span>
                  <span className="text-[9px] font-bold tracking-[0.24em] text-ink-400 uppercase sm:text-xs lg:text-sm">
                    Energy
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 text-center text-[10px] tracking-[0.28em] text-ink-600 uppercase lg:mt-12 lg:text-xs">
        Điểm chỉ thay đổi khi Game Master công bố
      </p>
    </div>
  );
}
