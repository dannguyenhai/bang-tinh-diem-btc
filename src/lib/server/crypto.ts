import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/* ------------------------------- PIN ------------------------------- */

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  try {
    const derived = scryptSync(pin, Buffer.from(saltHex, "hex"), 32);
    const expected = Buffer.from(hashHex, "hex");
    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}

/* ----------------------------- Phiên ------------------------------- */

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  // Không có secret riêng thì bám vào service role key — vẫn chỉ nằm ở server.
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback) return fallback;
  throw new Error(
    "Thiếu SESSION_SECRET (hoặc SUPABASE_SERVICE_ROLE_KEY) để ký phiên đăng nhập.",
  );
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

/** Đóng gói phiên thành chuỗi `payload.signature` để đặt vào cookie httpOnly. */
export function sealSession(value: object): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function openSession<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}
