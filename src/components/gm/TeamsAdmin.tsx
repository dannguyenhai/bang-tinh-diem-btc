"use client";

import { useRef, useState } from "react";
import { Badge, Button, Card, Stat, TextField } from "@/components/ui";
import { BOOSTER_META, DEFAULT_START_ENERGY, TEAM_IDS } from "@/lib/config";
import { normalizeGameData } from "@/lib/initialState";
import { useGameStore } from "@/lib/store";
import type { TeamId } from "@/lib/types";

export function TeamsAdmin() {
  const data = useGameStore((s) => s.data);
  const dispatch = useGameStore((s) => s.dispatch);
  const setError = useGameStore((s) => s.setError);
  const fileRef = useRef<HTMLInputElement>(null);

  const [gmPin, setGmPinValue] = useState("");
  const [startEnergy, setStartEnergy] = useState(String(DEFAULT_START_ENERGY));
  const [confirmReset, setConfirmReset] = useState(false);

  function exportJson() {
    // State ở client đã không còn pinHash — file sao lưu vì thế không chứa PIN.
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `make-your-move-${new Date().toISOString().slice(0, 19)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card title="Đội chơi" subtitle="Đổi tên hiển thị và PIN đăng nhập.">
        <div className="space-y-3">
          {TEAM_IDS.map((id) => (
            <TeamProfileRow key={id} teamId={id} />
          ))}
        </div>
      </Card>

      <Card
        title="PIN Game Master"
        subtitle="Để trống nghĩa là giữ nguyên PIN cũ."
      >
        <div className="flex items-end gap-2">
          <TextField
            className="flex-1"
            label="PIN mới (4–6 chữ số)"
            value={gmPin}
            inputMode="numeric"
            placeholder="••••"
            onChange={(e) => setGmPinValue(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            variant="subtle"
            disabled={gmPin.length < 4}
            onClick={async () => {
              const ok = await dispatch({ type: "setGmPin", pin: gmPin });
              if (ok) setGmPinValue("");
            }}
          >
            Lưu
          </Button>
        </div>
      </Card>

      <Card
        title="Sao lưu dữ liệu"
        subtitle="Tải file JSON trước mỗi vòng để phòng sự cố. File không chứa PIN."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="ghost" onClick={exportJson}>
            Xuất file JSON
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Nạp lại từ file
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const parsed = JSON.parse(await file.text());
              await dispatch({
                type: "importState",
                data: normalizeGameData(parsed),
              });
            } catch {
              setError("File không hợp lệ hoặc không đọc được.");
            }
          }}
        />
      </Card>

      <Card
        title="Reset ván chơi"
        subtitle="Xóa toàn bộ kết quả, Booster và nhật ký. PIN được giữ nguyên."
      >
        <div className="flex items-end gap-2">
          <TextField
            className="flex-1"
            label="Energy khởi đầu"
            value={startEnergy}
            inputMode="numeric"
            onChange={(e) => setStartEnergy(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            variant="danger"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              void dispatch({
                type: "resetGame",
                startEnergy: Number(startEnergy || 0),
              });
              setConfirmReset(false);
            }}
          >
            {confirmReset ? "Bấm lần nữa để xóa" : "Reset"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TeamProfileRow({ teamId }: { teamId: TeamId }) {
  const team = useGameStore((s) => s.data.teams[teamId]);
  const dispatch = useGameStore((s) => s.dispatch);
  const [name, setName] = useState(team.name);
  const [pin, setPin] = useState("");

  return (
    <div
      className="rounded-xl border border-ink-700 bg-ink-800/40 p-3"
      style={{ borderLeft: `3px solid ${team.color}` }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-sm font-black text-white">{team.name}</p>
        {team.boosterOwned ? (
          <Badge tone={team.boosterUsed ? "neutral" : "brand"}>
            {BOOSTER_META[team.boosterOwned].name.split(" — ")[0]}
            {team.boosterUsed ? " · đã dùng" : ""}
          </Badge>
        ) : (
          <Badge tone="neutral">Chưa có Booster</Badge>
        )}
      </div>

      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <Stat label="Energy" value={team.currentEnergy} tone="brand" />
        <Stat label="LED" value={team.publishedEnergy} tone="muted" />
      </div>

      <div className="flex items-end gap-2">
        <TextField
          className="flex-1"
          label="Tên đội"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          className="w-28"
          label="PIN mới"
          value={pin}
          inputMode="numeric"
          placeholder="giữ nguyên"
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
        <Button
          variant="subtle"
          onClick={async () => {
            const ok = await dispatch({
              type: "setTeamProfile",
              teamId,
              name,
              pin: pin.length >= 4 ? pin : undefined,
            });
            if (ok) setPin("");
          }}
        >
          Lưu
        </Button>
      </div>
    </div>
  );
}
