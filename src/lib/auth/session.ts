import crypto from "crypto";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "lp_wallet_session";
const NONCE_COOKIE = "lp_siws_nonce";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type WalletSession = {
  /** Solana base58 pubkey (32–44 chars) */
  address: string;
  cluster: string;
  issuedAt: number;
  expiresAt: number;
};

function secret(): string {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("Missing AUTH_SECRET. Add a long random value to .env.local.");
  return value;
}

function signPayload(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function encode(payload: WalletSession): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = signPayload(raw);
  return `${raw}.${sig}`;
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function decode(token: string): WalletSession | null {
  const [raw, sig] = token.split(".");
  if (!raw || !sig) return null;
  if (signPayload(raw) !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as WalletSession;
    if (typeof parsed.address !== "string" || !BASE58_RE.test(parsed.address)) return null;
    if (!Number.isFinite(parsed.expiresAt) || Date.now() / 1000 > parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

function nonceCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };
}

function buildWalletSessionToken(address: string, cluster: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: WalletSession = {
    address,
    cluster,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };
  return encode(payload);
}

/**
 * Route handlers must attach session cookies via `NextResponse.cookies`; using
 * `cookies().set()` alone often omits `Set-Cookie` on the HTTP response (mobile
 * + client `fetch` then never persist the session).
 */
export function appendWalletSessionCookie(
  res: NextResponse,
  address: string,
  cluster: string,
): void {
  res.cookies.set(SESSION_COOKIE, buildWalletSessionToken(address, cluster), sessionCookieOptions());
}

export function appendClearWalletSessionCookie(res: NextResponse): void {
  res.cookies.delete(SESSION_COOKIE);
}

export function appendSiwsNonceCookie(res: NextResponse, nonce: string): void {
  res.cookies.set(NONCE_COOKIE, nonce, nonceCookieOptions());
}

export function appendClearSiwsNonceCookie(res: NextResponse): void {
  res.cookies.delete(NONCE_COOKIE);
}

export async function createWalletSession(address: string, cluster: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, buildWalletSessionToken(address, cluster), sessionCookieOptions());
}

export async function clearWalletSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getWalletSession(): Promise<WalletSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decode(token);
}

export async function setSiwsNonce(nonce: string) {
  const store = await cookies();
  store.set(NONCE_COOKIE, nonce, nonceCookieOptions());
}

export async function getSiwsNonce(): Promise<string | null> {
  const store = await cookies();
  return store.get(NONCE_COOKIE)?.value ?? null;
}

export async function clearSiwsNonce() {
  const store = await cookies();
  store.delete(NONCE_COOKIE);
}
