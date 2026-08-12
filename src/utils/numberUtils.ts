export function truncateTo8Decimals(value: number): number {
  return Math.trunc(((value >= 0 ? value + 1e-10 : value - 1e-10) * 1e8)) / 1e8;
}
