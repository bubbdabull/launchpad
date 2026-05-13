import { createHash } from "node:crypto";

/** Deterministic 32-byte seed from public inputs (no hidden server salt). */
export function genesisDeterministicSeedBytes(input: {
  launchSlug: string;
  collectionMint: string;
  assetMint: string;
  /** Optional extra entropy committed in the same tx message (e.g. recent blockhash base58). */
  blockhashEntropy?: string;
}): Uint8Array {
  const h = createHash("sha256");
  h.update("creator-launchpad/genesis-pass/v1\0");
  h.update(input.launchSlug.trim(), "utf8");
  h.update("\0", "utf8");
  h.update(input.collectionMint.trim(), "utf8");
  h.update("\0", "utf8");
  h.update(input.assetMint.trim(), "utf8");
  if (input.blockhashEntropy?.trim()) {
    h.update("\0", "utf8");
    h.update(input.blockhashEntropy.trim(), "utf8");
  }
  return new Uint8Array(h.digest());
}

/** Mulberry32 PRNG — fast deterministic stream from a 32-bit seed. */
export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function u32FromBytes(b: Uint8Array, offset: number): number {
  const d = new DataView(b.buffer, b.byteOffset + offset, 4);
  return d.getUint32(0, false);
}

/** Build independent RNG streams from 32-byte seed (uses first 8 bytes for mulberry seeds). */
export function rngFromSeed32(seed32: Uint8Array, stream: number): () => number {
  const off = (stream * 4) % 28;
  const s = u32FromBytes(seed32, off) ^ u32FromBytes(seed32, (off + 4) % 28);
  return mulberry32(s >>> 0);
}
