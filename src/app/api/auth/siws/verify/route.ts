/**
 * @apiRouteLayer L3
 */


import { NextResponse } from "next/server";

import {
  clearSiwsNonce,
  createWalletSession,
  getSiwsNonce,
} from "@/lib/auth/session";
import { parseSiwsMessage, verifySiwsSignature } from "@/lib/auth/siws";
import { rateLimitOr429 } from "@/lib/security/apply-rate-limit";
import { envPositiveInt } from "@/lib/security/env-num";
import { readJsonBody } from "@/lib/security/request";

type VerifyBody = {
  message?: string;
  signature?: string;
  address?: string;
};

export async function POST(req: Request) {
  const limited = rateLimitOr429(req, {
    prefix: "siws:verify",
    max: envPositiveInt("RATE_LIMIT_SIWS_VERIFY_MAX", 30),
    windowMs: envPositiveInt("RATE_LIMIT_SIWS_VERIFY_WINDOW_MS", 15 * 60 * 1000),
  });
  if (limited) return limited;

  const parsed = await readJsonBody<VerifyBody>(req, 32 * 1024);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });

  const { message, signature, address } = parsed.data;
  if (!message || !signature || !address) {
    return NextResponse.json({ ok: false, error: "Missing message, signature, or address." }, { status: 400 });
  }

  const expectedNonce = await getSiwsNonce();
  if (!expectedNonce) {
    return NextResponse.json({ ok: false, error: "Nonce expired. Try signing in again." }, { status: 400 });
  }

  const fields = parseSiwsMessage(message);
  if (!fields.address || fields.address !== address) {
    return NextResponse.json({ ok: false, error: "Address mismatch." }, { status: 400 });
  }
  if (!fields.nonce || fields.nonce !== expectedNonce) {
    return NextResponse.json({ ok: false, error: "Nonce mismatch." }, { status: 400 });
  }

  const valid = verifySiwsSignature({ message, address, signature });
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Signature verification failed." }, { status: 401 });
  }

  await clearSiwsNonce();
  await createWalletSession(address, fields.cluster ?? "devnet");
  return NextResponse.json({ ok: true });
}
