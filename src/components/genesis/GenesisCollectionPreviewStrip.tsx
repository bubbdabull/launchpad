import Image from "next/image";

import { getAssetsByCollection } from "@/lib/solana/helius";

type Props = { collectionMint: string; title?: string };

/** Small DAS-backed strip for mint / launch pages (display only, L3). */
export async function GenesisCollectionPreviewStrip({ collectionMint, title = "Recent mints" }: Props) {
  let items: { id: string; img?: string }[] = [];
  try {
    const res = await getAssetsByCollection(collectionMint, { page: 1, limit: 8 });
    items = (res.items ?? []).map((a) => {
      const uri = a.content?.files?.[0]?.uri ?? a.content?.json_uri;
      return { id: a.id, img: typeof uri === "string" ? uri : undefined };
    });
  } catch {
    items = [];
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-panel/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <div
            key={it.id}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/40 sm:h-20 sm:w-20"
          >
            {it.img ? (
              <Image src={it.img} alt="" fill className="object-cover" sizes="80px" unoptimized />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-muted">Pass</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
