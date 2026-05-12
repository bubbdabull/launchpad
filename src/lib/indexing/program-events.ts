import type { SupabaseClient } from "@supabase/supabase-js";

export type ChainProgramEventRow = {
  signature: string;
  event_index: number;
  slot?: number | null;
  program_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  collection_slug?: string | null;
};

/**
 * Idempotent insert for Anchor / custom program events (unique on sig + index + name).
 */
export async function upsertChainProgramEvents(
  supabase: SupabaseClient,
  rows: ChainProgramEventRow[],
): Promise<{ inserted: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  for (const r of rows) {
    const { error } = await supabase.from("chain_program_events").upsert(
      {
        signature: r.signature,
        event_index: r.event_index,
        slot: r.slot ?? null,
        program_id: r.program_id,
        event_name: r.event_name,
        payload: r.payload,
        collection_slug: r.collection_slug ?? null,
      },
      { onConflict: "signature,event_index,event_name" },
    );
    if (error) errors.push(error.message);
    else inserted += 1;
  }
  return { inserted, errors };
}
