import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { SystemProgram, type Connection, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
/**
 * Instructions to allocate + initialize a standard SPL Token mint (classic program).
 * Caller must include `mint` in transaction signers.
 */
export async function buildCreateSplMintInstructions(
  connection: Connection,
  payer: PublicKey,
  mint: PublicKey,
  decimals: number,
): Promise<{ instructions: TransactionInstruction[]; lamports: number }> {
  if (decimals < 0 || decimals > 9) throw new Error("Mint decimals must be 0–9.");
  const lamports = await getMinimumBalanceForRentExemptMint(connection);
  const instructions: TransactionInstruction[] = [
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mint, decimals, payer, null, TOKEN_PROGRAM_ID),
  ];
  return { instructions, lamports };
}
