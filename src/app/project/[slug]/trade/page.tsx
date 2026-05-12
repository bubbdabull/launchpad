import { notFound } from "next/navigation";

import { TradeBattlefield } from "@/components/trade/TradeBattlefield";
import { getCollectionBySlug } from "@/lib/data/launchpad";

type Params = { slug: string };

export default async function TradeBattlefieldPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();

  return <TradeBattlefield collection={c} />;
}
