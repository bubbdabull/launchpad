/** Pick index `0..weights.length-1` weighted by positive `weights`. */
export function pickWeightedIndex(weights: number[], rnd: () => number): number {
  let total = 0;
  for (const w of weights) {
    if (w > 0) total += w;
  }
  if (total <= 0) return 0;
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    const w = Math.max(0, weights[i] ?? 0);
    if (w <= 0) continue;
    r -= w;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
