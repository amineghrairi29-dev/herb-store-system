/** Same rule as the backend: 8 digits (first 2-9), optional +216 / 00216 prefix. Returns the 8 digits. */
export function tunisianPhone(raw: string): string | null {
  const match = /^(?:\+216|00216|216)?([2-9]\d{7})$/.exec(raw.replace(/[\s().-]/g, ""));
  return match ? match[1] : null;
}
