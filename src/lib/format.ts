export function pct(minted: number, supply: number): string {
  if (supply <= 0) return "0";
  return ((100 * minted) / supply).toFixed(1);
}

export function shortAddress(addr: string, chars = 4): string {
  if (!addr.startsWith("0x") || addr.length < 10) return addr;
  return `${addr.slice(0, chars + 2)}…${addr.slice(-chars)}`;
}
