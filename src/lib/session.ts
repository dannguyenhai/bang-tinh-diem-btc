import type { GameData, Session } from "./types";

/**
 * Cookie chỉ còn giá trị khi số hiệu phiên khớp với ván chơi. Khôi phục toàn
 * bộ sẽ tăng số này, đá mọi thiết bị đang đăng nhập ra màn chọn vai.
 *
 * Hàm thuần, tách khỏi tầng cookie để test chạy được ngoài môi trường server.
 */
export function isSessionCurrent(
  session: Session | null,
  data: GameData,
): boolean {
  return session !== null && session.epoch === data.sessionEpoch;
}
