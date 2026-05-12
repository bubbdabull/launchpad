import { PublicKey } from "@solana/web3.js";

import { LC_MINT_ACTIVE } from "@/lib/launch-controller/launch-lifecycle-constants";
import { fetchDecodedLaunchState } from "@/lib/launch-controller/launch-state-read";
import { relaxedGenesisMintWithoutLifecycle } from "@/lib/launch/genesis-mint-config";
import { getConnection } from "@/lib/solana/connection";
import type { Collection } from "@/types/collection";

/** True when the Genesis mint lane may proceed (strict: Anchor `LC_MINT_ACTIVE`; relaxed: see `genesis-mint-config`). */
export async function fetchAnchorMintActive(
  c: Pick<Collection, "coreCollection" | "tokenMint" | "alphaVault">,
): Promise<boolean> {
  if (!c.coreCollection || !c.tokenMint || !c.alphaVault) return false;
  if (relaxedGenesisMintWithoutLifecycle()) {
    return true;
  }
  try {
    const decoded = await fetchDecodedLaunchState(getConnection(), new PublicKey(c.coreCollection));
    return decoded.lifecycle >= LC_MINT_ACTIVE;
  } catch {
    return false;
  }
}
