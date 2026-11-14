const COMBINING_MARKS = /\p{M}/gu;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;

/**
 * Folds a string for matching: lowercase, accents removed, punctuation turned
 * into spaces, whitespace collapsed. "  São Paulo " -> "sao paulo", "St. Louis" -> "st louis".
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim();
}
