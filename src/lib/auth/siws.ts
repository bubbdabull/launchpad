import "server-only";

import bs58 from "bs58";
import nacl from "tweetnacl";

import { getCluster } from "@/lib/solana/cluster";

const STATEMENT = "Sign in to Creator Launchpad.";

export type SiwsMessage = {
  domain: string;
  address: string;
  cluster: string;
  nonce: string;
  issuedAt: string;
};

/** Build the canonical message users sign. Both client and server must produce identical text. */
export function buildSiwsMessage(input: { domain: string; address: string; nonce: string }): string {
  const issuedAt = new Date().toISOString();
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    "",
    STATEMENT,
    "",
    `Cluster: ${getCluster()}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

/** Pull the address + nonce out of a previously built message (defence-in-depth). */
export function parseSiwsMessage(message: string): { address?: string; nonce?: string; cluster?: string } {
  const lines = message.split("\n");
  const address = lines[1]?.trim();
  const cluster = lines.find((l) => l.startsWith("Cluster: "))?.slice("Cluster: ".length).trim();
  const nonce = lines.find((l) => l.startsWith("Nonce: "))?.slice("Nonce: ".length).trim();
  return { address, nonce, cluster };
}

export function verifySiwsSignature(input: { message: string; address: string; signature: string }): boolean {
  try {
    const sig = bs58.decode(input.signature);
    const pub = bs58.decode(input.address);
    const msg = new TextEncoder().encode(input.message);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}
