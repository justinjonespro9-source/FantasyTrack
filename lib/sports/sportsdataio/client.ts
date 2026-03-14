import { getSportsDataIOApiKey } from "./config";
import { SPORTSDATAIO_BASE_URL } from "./config";

export type SportsDataIORequestOptions = {
  /** Path without leading slash, e.g. "v3/cbb/scores/JSON/teams" */
  path: string;
  /** Optional query params; key is added automatically from env */
  params?: Record<string, string>;
};

/**
 * GET request to SportsDataIO API. Adds API key as query param "key".
 * Throws if SPORTSDATAIO_API_KEY is not set.
 */
export async function sportsDataIOGet<T = unknown>(options: SportsDataIORequestOptions): Promise<T> {
  const key = getSportsDataIOApiKey();
  if (!key) {
    throw new Error("SPORTSDATAIO_API_KEY is not set");
  }

  const search = new URLSearchParams({ key, ...options.params });
  const url = `${SPORTSDATAIO_BASE_URL}/${options.path.replace(/^\//, "")}?${search.toString()}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SportsDataIO API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}
