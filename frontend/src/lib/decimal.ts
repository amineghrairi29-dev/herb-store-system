/** Keep decimal precision, accept a French comma, and pad to at least three decimals. */
export function normalizeDecimal(input: string): string | null {
  const value = input.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.padEnd(3, "0")}`;
}

/** Compare nonnegative normalized decimals without converting them to floats. */
export function compareDecimals(left: string, right: string): number {
  const [a, af = ""] = left.split(".");
  const [b, bf = ""] = right.split(".");
  if (a.length !== b.length) return a.length > b.length ? 1 : -1;
  if (a !== b) return a > b ? 1 : -1;
  const length = Math.max(af.length, bf.length);
  const x = af.padEnd(length, "0");
  const y = bf.padEnd(length, "0");
  return x === y ? 0 : x > y ? 1 : -1;
}
