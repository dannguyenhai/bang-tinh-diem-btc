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
  const [confirmFactory, setConfirmFactory] = useState(false);

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
      <Card
        title="Đổi tên đội & PIN"
        subtitle="Tên sửa ở đây sẽ đổi luôn trên màn LED, màn Care Team và nhật ký."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {TEAM_IDS.map((id, index) => (
            <TeamProfileRow key={id} teamId={id} index={index} />
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="PIN Game Master"
          subtitle="Để trống nghĩa là giữ nguyên PIN cũ."
          stagger={1}
        >
          <div className="flex items-end gap-2">
            <TextField
              className="flex-1"
              label="PIN mới (4–6 chữ số)"
              value={gmPin}
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              onChange={(e) => setGmPinValue(e.target.value.replace(/\D/g, ""))}
            />
            <Button
              variant={gmPin.length >= 4 ? "primary" : "subtle"}
              disabled={gmPin.length < 4}
              className="shrink-0"
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
          stagger={2}
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
          subtitle="Xóa toàn bộ kết quả, Booster và nhật ký. Tên đội và PIN được giữ nguyên."
          stagger={3}
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
                setConfirmFactory(false);
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

        <Card
          title="Khôi phục về mặc định"
          subtitle="Như lúc mới cài: xóa hết dữ liệu, trả tên đội và PIN về gốc."
          stagger={4}
        >
        <ul className="mb-3 space-y-1 text-xs text-ink-400">
          <li>· Tên đội về TEAM ALPHA / BETA / GAMMA / DELTA</li>
          <li>· PIN về 1111 · 2222 · 3333 · 4444, Game Master 9999</li>
          <li>· Xóa sạch kết quả 5 vòng, Booster, đấu giá và nhật ký</li>
        </ul>
        <Button
          full
          variant="danger"
          onClick={() => {
            if (!confirmFactory) {
              setConfirmFactory(true);
              setConfirmReset(false);
              return;
            }
            void dispatch({
              type: "factoryReset",
              startEnergy: Number(startEnergy || 0),
            });
            setConfirmFactory(false);
          }}
        >
          {confirmFactory
            ? "Bấm lần nữa — sẽ mất cả PIN đã đổi"
            : "Khôi phục toàn bộ về ban đầu"}
        </Button>
          {confirmFactory && (
            <p className="mt-2 text-center text-xs text-lose">
              Bạn vẫn ở lại phiên hiện tại, nhưng lần đăng nhập sau phải dùng
              PIN mặc định.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function TeamProfileRow({
  teamId,
  index = 0,
}: {
  teamId: TeamId;
  index?: number;
}) {
  const team = useGameStore((s) => s.data.teams[teamId]);
  const dispatch = useGameStore((s) => s.dispatch);
  const [name, setName] = useState(team.name);
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== team.name || pin.length >= 4;

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextField
          className="flex-1"
          label="Tên đội"
          value={name}
          maxLength={24}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <div className="flex items-end gap-2">
          <TextField
            className="w-28 shrink-0"
            label="PIN mới"
            value={pin}
            inputMode="numeric"
            maxLength={6}
            placeholder="giữ nguyên"
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ""));
              setSaved(false);
            }}
          />
          <Button
            variant={dirty ? "primary" : "subtle"}
            disabled={!dirty}
            className="shrink-0"
            onClick={async () => {
              const ok = await dispatch({
                type: "setTeamProfile",
                teamId,
                name,
                pin: pin.length >= 4 ? pin : undefined,
              });
              if (ok) {
                setPin("");
                setSaved(true);
              }
            }}
          >
            {saved ? "Đã lưu" : "Lưu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
