import type { MetadataRoute } from "next";
import { absoluteUrl, basePath } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/chat", "/guide", `${basePath}/`, `${basePath}/chat`, `${basePath}/guide`],
        disallow: ["/admin", "/api", `${basePath}/admin`, `${basePath}/api`]
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/")
  };
}
