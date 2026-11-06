/**
 * Company civil time zone.
 *
 * Every company is Eastern until its address is known. A new company insert
 * should call timeZoneForNewCompany with that address instead of leaving the
 * default in place. States that span more than one zone use the zone of most
 * of the state.
 *
 * America/New_York is Eastern: EST in winter and EDT in summer.
 */

export const EASTERN_TIME_ZONE = "America/New_York";

export type CompanyTimeZoneSource = "eastern_default" | "address";

export type CompanyAddress = {
  country?: string | null;
  region?: string | null;
};

const US_STATE_TIME_ZONES: Record<string, string> = {
  CT: "America/New_York",
  DE: "America/New_York",
  DC: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  IN: "America/Indiana/Indianapolis",
  KY: "America/New_York",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  NH: "America/New_York",
  NJ: "America/New_York",
  NY: "America/New_York",
  NC: "America/New_York",
  OH: "America/New_York",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  VT: "America/New_York",
  VA: "America/New_York",
  WV: "America/New_York",
  AL: "America/Chicago",
  AR: "America/Chicago",
  IL: "America/Chicago",
  IA: "America/Chicago",
  KS: "America/Chicago",
  LA: "America/Chicago",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  NE: "America/Chicago",
  ND: "America/Chicago",
  OK: "America/Chicago",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  WI: "America/Chicago",
  CO: "America/Denver",
  ID: "America/Boise",
  MT: "America/Denver",
  NM: "America/Denver",
  UT: "America/Denver",
  WY: "America/Denver",
  AZ: "America/Phoenix",
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  OR: "America/Los_Angeles",
  WA: "America/Los_Angeles",
  AK: "America/Anchorage",
  HI: "Pacific/Honolulu",
};

const CA_PROVINCE_TIME_ZONES: Record<string, string> = {
  ON: "America/Toronto",
  QC: "America/Toronto",
  NB: "America/Halifax",
  NS: "America/Halifax",
  PE: "America/Halifax",
  NL: "America/St_Johns",
  MB: "America/Winnipeg",
  SK: "America/Regina",
  AB: "America/Edmonton",
  BC: "America/Vancouver",
  YT: "America/Whitehorse",
  NT: "America/Yellowknife",
  NU: "America/Iqaluit",
};

function countryCode(country: string | null | undefined): string {
  const value = country?.trim().toLowerCase() ?? "";
  if (value === "us" || value === "usa" || value === "united states" || value === "united states of america") {
    return "US";
  }
  if (value === "ca" || value === "can" || value === "canada") return "CA";
  return "";
}

function regionCode(region: string | null | undefined): string {
  return region?.trim().toUpperCase() ?? "";
}

export function timeZoneForNewCompany(address?: CompanyAddress | null): {
  timeZone: string;
  source: CompanyTimeZoneSource;
} {
  const country = countryCode(address?.country);
  const region = regionCode(address?.region);
  const fromAddress =
    country === "US" ? US_STATE_TIME_ZONES[region] : country === "CA" ? CA_PROVINCE_TIME_ZONES[region] : undefined;
  if (fromAddress) return { timeZone: fromAddress, source: "address" };
  return { timeZone: EASTERN_TIME_ZONE, source: "eastern_default" };
}

export function companyTimeZoneLabel(timeZone: string | null | undefined): string {
  if (!timeZone || timeZone === EASTERN_TIME_ZONE) return "Eastern";
  return timeZone;
}
