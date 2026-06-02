import type { MetadataRoute } from "next";
import { getSeoBaseUrl } from "@/lib/site-url";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/how-to-play", changeFrequency: "monthly", priority: 0.9 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
  { path: "/cookies", changeFrequency: "monthly", priority: 0.3 },
  { path: "/disclaimer", changeFrequency: "monthly", priority: 0.3 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.7 },
  { path: "/dashboard", changeFrequency: "daily", priority: 0.8 },
  { path: "/series", changeFrequency: "daily", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSeoBaseUrl();
  const lastModified = new Date();

  return STATIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
