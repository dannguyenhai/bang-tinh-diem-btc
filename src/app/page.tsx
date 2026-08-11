"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner, LoadingScreen, SyncPill } from "@/components/AppShell";
import { Button, Panel } from "@/components/ui";
import { useGameStore } from "@/lib/store";
import type { TeamId } from "@/lib/types";

type Choice = { kind: "GM" } | { kind: "TEAM"; teamId: TeamId; name: string };

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useGameStore((s) => s.hydrated);
  const roster = useGameStore((s) => s.roster);
  const login = useGameStore((s) => s.login);

  const [choice, setChoice] = useState<Choice | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  if (!hydrated) return <LoadingScreen />;

  const label = choice?.kind === "GM" ? "GAME MASTER" : (choice?.name ?? "");

  async function submitPin(event: React.FormEvent) {
    event.preventDefault();
    if (!choice || busy) return;
    setBusy(true);
    const ok =
      choice.kind === "GM"
        ? await login("GM", null, pin)
        : await login("CARE_TEAM", choice.teamId, pin);
    setBusy(false);
    setPin("");
    if (ok) router.push(choice.kind === "GM" ? "/gm" : "/team");
  }

  return (
    <div className="hud-rings relative flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:py-14">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <SyncPill />
      </div>

      <header className="enter mb-10 text-center sm:mb-14">
        <h1 className="chrome chrome-sweep text-3xl leading-none font-black tracking-tight sm:text-5xl lg:text-6xl">
          MAKE YOUR MOVE
        </h1>
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-linear-to-r from-transparent to-neon sm:w-16" />
          <p className="neon-text text-[10px] font-bold tracking-[0.42em] text-neon-soft uppercase sm:text-xs">
            The Strategy Game
          </p>
          <span className="h-px w-8 bg-linear-to-l from-transparent to-neon sm:w-16" />
        </div>
      </header>

      <div className="w-full max-w-3xl">
        {!choice ? (
          <>
            <h2
              className="enter mb-5 text-center text-sm font-black tracking-[0.3em] text-ink-200 uppercase sm:text-base"
              style={{ "--stagger": 1 } as React.CSSProperties}
            >
              Bạn là ai?
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {roster.map((team, index) => (
                <button
                  key={team.id}
                  onClick={() =>
                    setChoice({
                      kind: "TEAM",
                      teamId: team.id,
                      name: team.name,
                    })
                  }
                  style={{ "--stagger": index + 2 } as React.CSSProperties}
                  className="enter group text-left transition-transform duration-150 ease-out active:scale-[0.985]"
                >
                  <Panel color={team.color}>
                    <div className="flex items-center gap-4 px-5 py-5">
                      <span
                        className="h-11 w-1 shrink-0"
                        style={{
                          background: team.color,
                          boxShadow: `0 0 14px ${team.color}`,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-black tracking-wide text-white">
                          {team.name}
                        </span>
                        <span className="block text-[10px] font-bold tracking-[0.24em] text-ink-400 uppercase">
                          Care Team
                        </span>
                      </span>
                      <span className="text-xl text-ink-600 transition-colors duration-150 group-hover:text-neon">
                        ›
                      </span>
                    </div>
                  </Panel>
                </button>
              ))}
            </div>

            <button
              onClick={() => setChoice({ kind: "GM" })}
              style={{ "--stagger": 6 } as React.CSSProperties}
              className="enter group mt-3 block w-full text-left transition-transform duration-150 ease-out active:scale-[0.985]"
            >
              <Panel>
                <div className="flex items-center gap-4 px-5 py-5">
                  <span className="h-11 w-1 shrink-0 bg-neon shadow-[0_0_14px_var(--color-neon)]" />
                  <span className="min-w-0 flex-1">
                    <span className="neon-text block text-lg font-black tracking-wide text-neon-soft">
                      GAME MASTER
                    </span>
                    <span className="block text-[10px] font-bold tracking-[0.24em] text-ink-400 uppercase">
                      Toàn quyền điều hành
                    </span>
                  </span>
                  <span className="text-xl text-neon">›</span>
                </div>
              </Panel>
            </button>

            <Link
              href="/scoreboard"
              style={{ "--stagger": 7 } as React.CSSProperties}
              className="enter mt-6 block border border-dashed border-ink-700 px-4 py-3.5 text-center text-xs font-bold tracking-[0.24em] text-ink-400 uppercase transition-colors duration-150 ease-out hover:border-neon hover:text-neon"
            >
              Màn hình Scoreboard
            </Link>
          </>
        ) : (
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={() => {
                setChoice(null);
                setPin("");
              }}
              className="mb-5 text-[11px] font-bold tracking-[0.24em] text-ink-400 uppercase transition-colors duration-150 hover:text-neon"
            >
              ‹ Chọn lại
            </button>

            <Panel breathe>
              <form onSubmit={submitPin} className="px-6 py-7 sm:px-8 sm:py-9">
                <p className="text-center text-[10px] font-bold tracking-[0.28em] text-ink-400 uppercase">
                  Đăng nhập với vai
                </p>
                <h2 className="mt-2 mb-7 text-center text-2xl font-black tracking-wide text-white sm:text-3xl">
                  {label}
                </h2>

                <label className="block">
                  <span className="mb-2.5 block text-center text-[10px] font-bold tracking-[0.24em] text-ink-400 uppercase">
                    Nhập PIN
                  </span>
                  <input
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    value={pin}
                    maxLength={6}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    className="rounded-lg tabular w-full border border-ink-600 bg-ink-950 px-4 py-5 text-center text-3xl font-black tracking-[0.5em] text-white outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-neon focus:shadow-[0_0_24px_-6px_var(--color-neon)]"
                    placeholder="••••"
                  />
                </label>

                <Button
                  type="submit"
                  full
                  className="mt-6"
                  disabled={pin.length < 4 || busy}
                >
                  {busy ? "Đang kiểm tra…" : "Vào hệ thống"}
                </Button>
                <p className="mt-3 text-center text-[11px] text-ink-400">
                  PIN được kiểm tra ở máy chủ, không lưu trong trình duyệt.
                </p>
              </form>
            </Panel>
          </div>
        )}
      </div>

      <ErrorBanner />
    </div>
  );
}
