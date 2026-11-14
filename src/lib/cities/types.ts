/** One city from the bundled GeoNames dataset. */
export type City = {
  /** GeoNames id; stable across dataset regenerations. Used to persist pins. */
  readonly id: number;
  /** Display name, may contain accents ("São Paulo"). */
  readonly name: string;
  /** ASCII-only name ("Sao Paulo"). */
  readonly ascii: string;
  /** ISO-3166 alpha-2 country code ("BR"). */
  readonly cc: string;
  /** First-level region name ("Oregon"), or "" when unknown. */
  readonly admin1: string;
  /** Population, used to rank search results. */
  readonly pop: number;
  /** IANA time zone id ("America/Sao_Paulo"). */
  readonly tz: string;
};
