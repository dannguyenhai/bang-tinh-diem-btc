# Make Your Move — Web quản lý điểm gameshow

Next.js 15 + Supabase. Đồng bộ realtime giữa nhiều thiết bị: Game Master điều hành trên laptop, 4 Care Team nhập trên máy của đội, màn LED mở riêng một tab.

Phân quyền được cưỡng chế ở **backend**, không phải chỉ ẩn nút trên giao diện.

## Chạy tại máy

```bash
npm install
npm run dev        # http://localhost:3000
npm run verify     # 193 test: công thức tính điểm, vòng đời Booster, đấu giá, phân quyền, lọc dữ liệu
```

## Thiết lập (làm một lần)

**1. Tạo bảng.** Mở [SQL Editor](https://supabase.com/dashboard/project/luwfamkepuoebumfctyv/sql/new), dán toàn bộ [`supabase/schema.sql`](supabase/schema.sql), Run.

**2. Lấy service_role key** tại [Settings → API Keys](https://supabase.com/dashboard/project/luwfamkepuoebumfctyv/settings/api-keys), dán vào `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Key này bỏ qua toàn bộ RLS. Nó **chỉ được** nằm ở biến môi trường server — không đặt tiền tố `NEXT_PUBLIC_`, không commit, không dán vào code client.

**3. Chạy `npm run dev`.** Lần mở đầu tiên app tự seed ván chơi.

## Deploy Vercel

Khai 5 biến trong Project Settings → Environment Variables:

| Biến | Loại |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | công khai |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | công khai |
| `NEXT_PUBLIC_GAME_ID` | công khai |
| `SUPABASE_SERVICE_ROLE_KEY` | **bí mật** |
| `SESSION_SECRET` | **bí mật** — `openssl rand -base64 32` |

Thiếu `SUPABASE_SERVICE_ROLE_KEY` thì app không chạy được: mọi thao tác đều đi qua server.

## Tài khoản mặc định

| Vai | PIN |
|---|---|
| TEAM ALPHA | 1111 |
| TEAM BETA | 2222 |
| TEAM GAMMA | 3333 |
| TEAM DELTA | 4444 |
| Game Master | 9999 |

Đổi trong GM → tab **Đội** trước buổi ghi hình. PIN lưu dạng scrypt hash, không lưu bản thô.

## Bốn màn hình

| Đường dẫn | Dùng cho |
|---|---|
| `/` | Chọn vai + nhập PIN |
| `/gm` | Game Master điều hành toàn bộ |
| `/team` | Care Team nhập Investment, Booster, đấu giá |
| `/scoreboard` | Màn LED — chỉ đổi khi GM bấm Publish |

## Trình tự vận hành một buổi

1. **Đặt tên**: mỗi Care Team đăng nhập và tự nhập tên đội mình (chỉ được trước khi mở nguồn Energy). GM đổi tên và PIN bất cứ lúc nào ở tab **Đội & PIN**.
2. **GM → Điều hành**: nhập Energy khởi đầu → *Công bố Energy khởi đầu*.
3. **TT1, TT2**: mở vòng → Care Team gửi Investment → *Khóa Investment* → *Mở nhập kết quả* → WIN/LOSE từng đội → *Chuyển sang soát* → *Khóa kết quả* → *Publish Scoreboard*.
4. **Đấu giá** (sau khi TT2 đã khóa): *Snapshot Energy & mở vòng kín* → 4 đội gửi phiếu → *Khóa phiếu* → *Xếp thứ tự theo mức quan tâm* → chạy từng lô → phân bổ phần còn lại.
5. **TT3**: không đầu tư, thua không mất Energy.
6. **TT4, TT5**: Care Team chốt Investment + kích hoạt Alpha/Gamma trước giờ thi đấu; sau khi có kết quả, GM *Mở Booster Response* cho các đội thua đang giữ Beta/Delta.

## Luật đã cài trong hệ thống

- Trần đầu tư `max(1, floor(Energy × 30%))`; Energy = 0 thì chỉ nhập 0.
- Reward: TT1 50 · TT2 60 · TT3 70 · TT4 90 · TT5 100. TT3 không đầu tư, thua giữ nguyên Energy.
- Alpha `+min(reward, 40)` khi thắng, `-10` thêm khi thua (chặn sàn 0). Gamma `+floor(reward × 50%)`, thua không phạt thêm. Cả hai phải chốt trước giờ thi đấu và tính là đã dùng dù thắng hay thua.
- Beta che tối đa 25 Energy Investment. Delta hoàn `min(floor(investment × 50%), 20)`. Cả hai chỉ cần đội thua là được quyền dùng — không có thêm điều kiện nào.
- Quỹ đấu giá `floor(Energy sau TT2 × 80%)`. Giá kín không bị trừ Energy — chỉ đội thắng mới trả.
- Thứ tự lên sàn: Booster có **tổng điểm đặt cao nhất** đấu trước; hòa tổng thì xáo trộn.
- Vòng công khai: top 2 giá kín > 0 trong nhóm chưa có Booster, bước giá `+5`, trần bằng quỹ. Hòa thì hệ thống bốc thăm, đội trúng trả **đúng giá kín của chính mình**; đã có nâng giá công khai thì trả giá chốt.
- Không ai đặt giá → lô `SKIPPED`, xuống vòng phân bổ với giá `min(quỹ, max(giá kín, 5))`. **Booster cuối cùng** (còn đúng 1 đội và 1 Booster) mua với `floor(quỹ × 50%)`. Quỹ = 0 thì nhận giá 0.
- Nhiều đội cùng thắng một thử thách là hợp lệ — hệ thống tính độc lập từng đội.
- Energy chỉ đổi khi GM **Khóa kết quả**; LED chỉ đổi khi GM **Publish**.
- Sửa dữ liệu đã khóa phải qua *Mở lại kết quả* + lý do, ghi vào nhật ký.

## Mô hình bảo mật

Trình duyệt **không có** đường nào chạm tới bảng dữ liệu.

```
Trình duyệt ──POST /api/action──> Route handler (server)
                                    ├─ đọc cookie httpOnly ký HMAC → biết là ai
                                    ├─ authorize(): Care Team chỉ chạy được 5 loại
                                    │  hành động, và chỉ trên teamId của chính mình
                                    ├─ applyAction(): kiểm tra luật chơi
                                    ├─ ghi Supabase bằng service_role + kiểm version
                                    └─ redactForSession(): cắt bỏ dữ liệu ngoài quyền
                                       ↓
Trình duyệt <────── JSON đã lọc ─────┘
```

| Lớp | Cách chặn |
|---|---|
| `game_state` | RLS bật, **không có policy nào** → anon key đọc/ghi đều trượt |
| `game_pulse` | anon chỉ đọc được đúng một con số `version` để nhận tín hiệu realtime |
| Phiên đăng nhập | cookie `httpOnly` + `sameSite=lax`, ký HMAC-SHA256 bằng `SESSION_SECRET`; JS trên trang không đọc được |
| PIN | scrypt + salt ngẫu nhiên; `pinHash` bị xóa trước khi JSON rời server, kể cả với GM |
| Hành động | `CARE_TEAM_ACTIONS` — Care Team chỉ gửi được tên đội, Investment, Booster Response, phiếu kín, nâng giá, chọn Booster phân bổ |
| Dữ liệu trả về | Care Team không nhận được Energy nội bộ, Investment, giá kín, quỹ đấu giá của đội khác, và không nhận nhật ký |

Sửa payload trong DevTools cũng không qua được: server không tin bất cứ thứ gì client gửi ngoài `type` và tham số, còn danh tính lấy từ cookie đã ký.

`npm run verify` có 25 test riêng cho phần này — Care Team gọi `lockResult`, `publishScoreboard`, `setGmPin`, hay nhập hộ đội khác đều phải bị từ chối; và bản JSON gửi cho Care Team phải không chứa số liệu của ba đội còn lại.

## Kiến trúc

```
src/lib/engine.ts          công thức tính điểm — hàm thuần
src/lib/mutations.ts       thao tác hợp lệ trên ván chơi + nhật ký
src/lib/actions.ts         tập hành động client được phép gửi
src/lib/server/crypto.ts   scrypt cho PIN, HMAC cho cookie phiên
src/lib/server/dispatch.ts kiểm quyền rồi áp hành động
src/lib/server/redact.ts   cắt dữ liệu theo vai trước khi trả về
src/lib/server/gameStore.ts đọc/ghi Supabase bằng service_role
src/app/api/*              login · logout · state · action
scripts/verify.ts          193 test
```

Toàn bộ ván chơi là một dòng JSONB. Mỗi lần ghi kèm `version` cũ; nếu máy khác vừa ghi trước, server đọc lại bản mới và áp lại hành động (tối đa 5 lần) — GM và Care Team bấm cùng lúc không mất dữ liệu.

## Giới hạn còn lại

- **Đổi PIN không đá phiên đang đăng nhập.** Cookie cũ vẫn dùng được tới 12 tiếng. Muốn đá ngay thì phải thêm phiên bản token vào state.
- **Chống dò PIN mới ở mức cơ bản**: mỗi lần sai bị giữ 400ms, chưa khóa theo IP. PIN 4 chữ số nội bộ dùng một buổi thì đủ; công khai lâu dài thì nên tăng lên 6 chữ số.
- Đổi `NEXT_PUBLIC_GAME_ID` là sang một ván chơi độc lập — tiện để chạy thử rồi reset sạch cho buổi thật.
- Trước mỗi vòng nên bấm **Xuất file JSON** ở tab Đội để có bản sao lưu ngoài. File này không chứa PIN; nạp lại sẽ giữ nguyên PIN hiện hành.
