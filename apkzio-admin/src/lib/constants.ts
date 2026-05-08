/**
 * Legitimate reference data (NOT mock data)
 * These are ISO standard values that don't change
 */

export const COUNTRIES = [
  "BD", "IN", "PK", "NG", "ID", "PH", "VN", "TH", "MY", "KH",
  "US", "GB", "CA", "AU", "DE", "FR", "IT", "ES", "NL", "BR"
] as const;

export const COUNTRY_NAMES: Record<string, string> = {
  BD: "Bangladesh",
  IN: "India",
  PK: "Pakistan",
  NG: "Nigeria",
  ID: "Indonesia",
  PH: "Philippines",
  VN: "Vietnam",
  TH: "Thailand",
  MY: "Malaysia",
  KH: "Cambodia",
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  NL: "Netherlands",
  BR: "Brazil",
};
