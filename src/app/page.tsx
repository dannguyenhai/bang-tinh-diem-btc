"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBanner, LoadingScreen, SyncPill } from "@/components/AppShell";
import { Button } from "@/components/ui";
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
    <div className="flex min-h-dvh flex-col px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[0.3em] text-brand uppercase">
              Make Your Move
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              The Strategy Game
            </h1>
          </div>
          <SyncPill />
        </div>

        {!choice ? (
          <>
            <h2 className="mb-4 text-lg font-black tracking-wide text-white">
              BẠN LÀ AI?
            </h2>
            <div className="space-y-2.5">
              {roster.map((team) => (
                <button
                  key={team.id}
                  onClick={() =>
                    setChoice({
                      kind: "TEAM",
                      teamId: team.id,
                      name: team.name,
                    })
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900/70 px-4 py-4 text-left transition-colors hover:border-brand"
                >
                  <span
                    className="h-8 w-1.5 rounded-full"
                    style={{ background: team.color }}
                  />
                  <span className="flex-1">
                    <span className="block text-base font-bold text-white">
                      {team.name}
                    </span>
                    <span className="block text-xs text-ink-400">Care Team</span>
                  </span>
                  <span className="text-ink-400">›</span>
                </button>
              ))}

              <button
                onClick={() => setChoice({ kind: "GM" })}
                className="flex w-full items-center gap-3 rounded-2xl border border-brand/50 bg-brand/10 px-4 py-4 text-left transition-colors hover:bg-brand/20"
              >
                <span className="h-8 w-1.5 rounded-full bg-brand" />
                <span className="flex-1">
                  <span className="block text-base font-bold text-brand">
                    GAME MASTER
                  </span>
                  <span className="block text-xs text-brand-dim">
                    Toàn quyền điều hành
                  </span>
                </span>
                <span className="text-brand">›</span>
              </button>
            </div>

            <Link
              href="/scoreboard"
              className="mt-6 block rounded-2xl border border-dashed border-ink-700 px-4 py-3.5 text-center text-sm font-bold tracking-wider text-ink-200 uppercase hover:border-info hover:text-info"
            >
              Màn hình Scoreboard (LED)
            </Link>
          </>
        ) : (
          <form onSubmit={submitPin} className="flex flex-1 flex-col">
            <button
              type="button"
              onClick={() => {
                setChoice(null);
                setPin("");
              }}
              className="mb-6 self-start text-xs font-bold text-ink-400 uppercase hover:text-white"
            >
              ‹ Chọn lại
            </button>

            <p className="text-xs font-bold tracking-[0.2em] text-ink-400 uppercase">
              Đăng nhập với vai
            </p>
            <h2 className="mt-1 mb-6 text-2xl font-black text-white">{label}</h2>

            <label className="block">
              <span className="mb-2 block text-[11px] font-bold tracking-[0.14em] text-ink-400 uppercase">
                Nhập PIN
              </span>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                value={pin}
                maxLength={6}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="tabular w-full rounded-2xl border border-ink-600 bg-ink-950 px-4 py-5 text-center text-3xl font-black tracking-[0.5em] text-white outline-none focus:border-brand"
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
            <p className="mt-3 text-center text-xs text-ink-400">
              PIN được kiểm tra ở máy chủ, không lưu trong trình duyệt.
            </p>
          </form>
        )}
      </div>

      <ErrorBanner />
    </div>
  );
}
