import type { GenesisPassNftConfig } from "@/types/genesis-pass-nft";

export type RevealPhase = "unrevealed" | "revealed";

export function parseRevealAtMs(config: GenesisPassNftConfig | undefined): number | undefined {
  const raw = config?.revealAt?.trim();
  if (!raw) return undefined;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Metadata + marketplace display gate: cosmetic only. */
export function genesisRevealPhase(nowMs: number, config: GenesisPassNftConfig | undefined): RevealPhase {
  const t = parseRevealAtMs(config);
  if (t == null) return "revealed";
  return nowMs >= t ? "revealed" : "unrevealed";
}
