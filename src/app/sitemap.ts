import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

const PUBLIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/map", changeFrequency: "weekly", priority: 0.9 },
  { path: "/diary", changeFrequency: "weekly", priority: 0.8 },
  { path: "/wishlist", changeFrequency: "weekly", priority: 0.8 },
  { path: "/profile", changeFrequency: "monthly", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date("2026-11-24T00:00:00.000Z");

  return PUBLIC_ROUTES.map((route) => ({
    url: route.path === "/" ? siteUrl : `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
