// Formats numbers with apostrophe thousands separators (e.g. 1'234'567).
// Handles negatives and decimals; leaves non-finite values untouched.
export function formatNumber(value) {
  if (value === null || value === undefined) return "0";
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? "-" : "";
  const [intPart, fracPart] = Math.abs(value).toString().split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return fracPart ? `${sign}${withSep}.${fracPart}` : `${sign}${withSep}`;
}
