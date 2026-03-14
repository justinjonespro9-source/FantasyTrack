/**
 * SportsDataIO API configuration. Uses env only for credentials.
 */

export function getSportsDataIOApiKey(): string | undefined {
  return process.env.SPORTSDATAIO_API_KEY;
}

export const SPORTSDATAIO_BASE_URL = "https://api.sportsdata.io";
