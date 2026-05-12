import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";

import { launchStatePda } from "./pdas";
import { decodeLaunchStateAccountData } from "./launch-state-codec";

export async function fetchDecodedLaunchState(
  connection: Connection,
  collectionMint: PublicKey,
): Promise<ReturnType<typeof decodeLaunchStateAccountData>> {
  const [launchState] = launchStatePda(collectionMint);
  const info = await connection.getAccountInfo(launchState, "confirmed");
  if (!info?.data) {
    throw new Error("LaunchState not initialized yet.");
  }
  return decodeLaunchStateAccountData(Buffer.from(info.data));
}
