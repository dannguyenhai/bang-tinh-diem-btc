import "server-only";

import { cookies } from "next/headers";
import type { Session } from "@/lib/types";
import { openSession, sealSession } from "./crypto";

export const SESSION_COOKIE = "mym_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // đủ một buổi ghi hình

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const session = openSession<Session>(token);
  if (!session || (session.role !== "GM" && session.role !== "CARE_TEAM")) {
    return null;
  }
  if (session.role === "CARE_TEAM" && !session.teamId) return null;
  return session;
}

export async function writeSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sealSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
