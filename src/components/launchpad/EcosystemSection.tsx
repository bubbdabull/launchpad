import Link from "next/link";

const cards = [
  {
    title: "Mint",
    body: "Pick a launch and mint the Genesis Pass from your wallet.",
    href: "/#launches",
    cta: "Browse launches",
  },
  {
    title: "Trade",
    body: "When liquidity is live, trade on Meteora or your wallet of choice.",
    href: "/#launches",
    cta: "View launches",
  },
  {
    title: "Create",
    body: "Publish a new collection and go through deploy with your wallet.",
    href: "/create",
    cta: "Start",
  },
];

export function EcosystemSection() {
  return (
    <section className="rounded-2xl border border-line bg-panel/80 px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">How it works</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Three steps
        </h2>
        <p className="mt-2 text-sm text-muted">Connect your wallet, choose a launch, then mint or create.</p>
      </div>
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="flex flex-col rounded-2xl border border-line bg-ink/50 p-6">
            <h3 className="font-display text-lg font-semibold text-white">{card.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{card.body}</p>
            <Link href={card.href} className="mt-5 text-sm font-medium text-accent hover:underline">
              {card.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
