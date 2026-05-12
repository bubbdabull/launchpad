import { sanitizeProjectPageDoc, type ProjectPageDoc } from "@/lib/launch/project-page";

/** Payload returned by `/api/ai/generate-full-project` (matches structured chat output). */
export type FullProjectCopy = {
  tagline: string;
  description: string;
  tokenSymbol: string;
  suggestedSupply: number;
  suggestedMintPriceSol: number;
  utilities: [string, string, string];
  creatorVestingSupplyPct: number;
  creatorVestingCliffMonths: number;
  creatorVestingPeriodMonths: number;
  tokenHolderRewardPct: number;
  styleHint: string;
  phase: string;
  story: string;
  roadmap: string;
  community: string;
  holderRewardPct: number;
  /** `#RRGGBB` / `#RGB` or empty string for platform default accent on /project/[slug]. */
  projectAccentHex: string;
  /** Hero layout for the project page only. */
  projectHeroLayout: "classic" | "minimal" | "split";
  /** Optional override for launch name on /project/[slug] only; empty = use launch name. */
  projectPageHeadline: string;
  /** Optional hero subhead on /project/[slug] only; empty = use tagline. */
  projectPageSubhead: string;
  /** True when custom story blocks cover the default description block. */
  projectHideDefaultDescription: boolean;
  /** True to hide the default stats grid on the project page. */
  projectHideDefaultStats: boolean;
  /** 2–5 narrative sections for the project page story builder (no markdown). */
  projectTextBlocks: Array<{ heading: string; body: string }>;
  /** Optional FAQs for collectors; merged into one FAQ story block when non-empty. */
  projectFaq: Array<{ question: string; answer: string }>;
};

/**
 * Map AI-generated story payloads into a sanitized ProjectPageDoc (blocks + default-section toggles).
 */
export function projectPageDocFromAiStoryBlocks(copy: {
  projectTextBlocks: FullProjectCopy["projectTextBlocks"];
  projectFaq: FullProjectCopy["projectFaq"];
  projectHideDefaultDescription: boolean;
  projectHideDefaultStats: boolean;
}): ProjectPageDoc {
  const blocks: Array<Record<string, unknown>> = [];
  for (const row of copy.projectTextBlocks) {
    const body = typeof row.body === "string" ? row.body.trim() : "";
    if (!body) continue;
    const headingRaw = typeof row.heading === "string" ? row.heading.trim() : "";
    blocks.push({
      type: "text",
      ...(headingRaw ? { heading: headingRaw } : {}),
      body,
    });
  }
  const faqItems = copy.projectFaq
    .map((x) => ({
      question: typeof x.question === "string" ? x.question.trim() : "",
      answer: typeof x.answer === "string" ? x.answer.trim() : "",
    }))
    .filter((x) => x.question.length > 0 && x.answer.length > 0);
  if (faqItems.length > 0) {
    blocks.push({
      type: "faq",
      heading: "FAQ",
      items: faqItems,
    });
  }
  const sanitized = sanitizeProjectPageDoc({
    blocks,
    hideDefaultDescription: !!copy.projectHideDefaultDescription,
    hideDefaultStats: !!copy.projectHideDefaultStats,
  });
  return (
    sanitized ?? {
      blocks: [],
      hideDefaultDescription: false,
      hideDefaultStats: false,
    }
  );
}
