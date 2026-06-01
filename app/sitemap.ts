import type { MetadataRoute } from "next";
import { publicRoutes } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes;
}
