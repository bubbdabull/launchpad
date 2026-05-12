/** Shared DALL·E prompts for collection artwork (also used by batch full-project generation). */
export function buildLaunchImagePrompt(input: {
  kind: "banner" | "logo" | "gallery";
  launchName: string;
  tagline: string;
  description: string;
  styleHint: string;
}): string {
  const base = `Solana NFT launch artwork for "${input.launchName}". ${input.tagline ? `Tagline: ${input.tagline}.` : ""}`;
  const desc = input.description ? ` Context: ${input.description.slice(0, 400)}` : "";
  const style = input.styleHint ? ` Style direction: ${input.styleHint.slice(0, 200)}.` : "";
  const noText =
    " No letters, no words, no logos, no watermarks — purely illustrative art suitable as a digital collectible header.";

  if (input.kind === "banner") {
    return `${base}${desc}${style} Ultra-wide cinematic key art, dramatic lighting, rich detail, 21:9 feel, game poster quality.${noText}`;
  }
  if (input.kind === "logo") {
    return `${base}${desc}${style} Square avatar / app icon: single bold mascot or symbol centered on clean background, readable at small size, high contrast.${noText}`;
  }
  return `${base}${desc}${style} Additional hero illustration, portrait-friendly composition, striking color palette, collectible vibe.${noText}`;
}
