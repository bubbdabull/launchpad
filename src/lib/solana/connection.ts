import "server-only";

import { Connection } from "@solana/web3.js";

import { getRpcUrl } from "./cluster";

let cached: Connection | null = null;

/** Server-side Connection. Do not use in client components. */
export function getConnection(): Connection {
  if (!cached) {
    cached = new Connection(getRpcUrl(), { commitment: "confirmed" });
  }
  return cached;
}
