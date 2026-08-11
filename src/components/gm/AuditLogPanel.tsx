"use client";

import { Card, Empty } from "@/components/ui";
import { CHALLENGES } from "@/lib/config";
import { useGameStore } from "@/lib/store";
import type { ChallengeId } from "@/lib/types";

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AuditLogPanel() {
  const log = useGameStore((s) => s.data.auditLog);
  const teams = useGameStore((s) => s.data.teams);

  return (
    <Card
      title="Nhật ký thao tác"
      subtitle="Mọi thay đổi quan trọng đều được ghi lại."
    >
      {log.length === 0 ? (
        <Empty>Chưa có thao tác nào.</Empty>
      ) : (
        <ol className="space-y-1.5">
          {log.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg border border-ink-700 bg-ink-800/40 px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="tabular text-[11px] text-ink-400">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-[11px] font-bold text-info">
                  {entry.actor}
                </span>
                {entry.challengeId && (
                  <span className="text-[11px] text-brand">
                    {CHALLENGES[entry.challengeId as ChallengeId].shortName}
                  </span>
                )}
                {entry.teamId && (
                  <span className="text-[11px] text-ink-200">
                    {teams[entry.teamId].name}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white">{entry.action}</p>
              {(entry.oldValue !== null || entry.newValue !== null) && (
                <p className="tabular text-xs text-ink-400">
                  {entry.oldValue !== null && <span>{entry.oldValue} → </span>}
                  <span className="text-win">{entry.newValue}</span>
                </p>
              )}
              {entry.reason && (
                <p className="mt-0.5 text-xs text-brand">Lý do: {entry.reason}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
