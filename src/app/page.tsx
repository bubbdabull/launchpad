import { CreatorMarketChrome } from "@/components/market/CreatorMarketChrome";
import { EcosystemSection } from "@/components/launchpad/EcosystemSection";
import { LaunchpadHome } from "@/components/launchpad/LaunchpadHome";
import { getLaunchpadPageData } from "@/lib/data/launchpad";

export default async function HomePage() {
  const { collections, featured, platformStats } = await getLaunchpadPageData();

  return (
    <div className="pb-16 sm:pb-20">
      <CreatorMarketChrome featured={featured} collections={collections} platformStats={platformStats}>
        <div id="launches" className="scroll-mt-28 space-y-6 pb-6 pt-4">
          <LaunchpadHome collections={collections} />
        </div>
      </CreatorMarketChrome>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <EcosystemSection />
      </div>
    </div>
  );
}
