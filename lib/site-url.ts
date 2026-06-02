export const CANONICAL_SITE_URL = "https://www.fantasytrack.app";

function normalizeSiteUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalSiteUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

export function getSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (envUrl) {
    return normalizeSiteUrl(envUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return CANONICAL_SITE_URL;
  }

  return "http://localhost:3000";
}

/** Canonical base URL for metadata, robots, and sitemap. */
export function getSeoBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (envUrl && !isLocalSiteUrl(envUrl)) {
    return normalizeSiteUrl(envUrl);
  }

  return CANONICAL_SITE_URL;
}
