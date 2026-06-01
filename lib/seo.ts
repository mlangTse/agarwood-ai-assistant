import type { MetadataRoute } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/agarwood";
export const basePath = rawBasePath === "/" ? "" : rawBasePath.replace(/\/$/, "");

const configuredOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://mlangtse.top").replace(/\/$/, "");
export const siteUrl = configuredOrigin.endsWith(basePath) ? configuredOrigin : `${configuredOrigin}${basePath}`;

export const siteName = "沉香 AI 助手";
export const defaultDescription =
  "面向沉香文博馆、高端品牌和私域导购的中文 AI 助手，提供闻香建议、沉香百科、产品推荐和可追溯知识库问答。";
export const defaultKeywords = [
  "沉香",
  "沉香 AI",
  "闻香导师",
  "沉香百科",
  "沉香导购",
  "奇楠",
  "线香",
  "沉香知识库"
];

export const publicRoutes: MetadataRoute.Sitemap = [
  {
    url: `${siteUrl}/`,
    lastModified: new Date("2026-06-01"),
    changeFrequency: "weekly",
    priority: 1
  },
  {
    url: `${siteUrl}/chat`,
    lastModified: new Date("2026-06-01"),
    changeFrequency: "weekly",
    priority: 0.9
  },
  {
    url: `${siteUrl}/guide`,
    lastModified: new Date("2026-06-01"),
    changeFrequency: "monthly",
    priority: 0.8
  }
];

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c")
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: siteName,
    url: siteUrl,
    description: defaultDescription,
    knowsAbout: ["沉香产区", "奇楠", "线香", "沉香香韵", "沉香礼赠", "沉香收藏风险"]
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: siteName,
    url: siteUrl,
    inLanguage: "zh-CN",
    description: defaultDescription,
    publisher: { "@id": `${siteUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/chat")}?module=encyclopedia&q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function localBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#local-business`,
    name: siteName,
    url: siteUrl,
    description: "为沉香文博馆、品牌展厅和私域导购提供 AI 闻香、问答与推荐服务。",
    areaServed: "中国",
    priceRange: "¥¥-¥¥¥¥",
    parentOrganization: { "@id": `${siteUrl}/#organization` }
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

export function productJsonLd(product: {
  name: string;
  description: string;
  price: string;
  category: string;
  tags: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: product.category,
    brand: { "@id": `${siteUrl}/#organization` },
    additionalProperty: product.tags.map((tag) => ({
      "@type": "PropertyValue",
      name: "香韵/场景标签",
      value: tag
    })),
    offers: {
      "@type": "Offer",
      priceCurrency: "CNY",
      price: product.price,
      availability: "https://schema.org/InStock",
      url: absoluteUrl("/chat?module=shopping")
    }
  };
}

export function articleJsonLd(article: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  author: string;
  reviewer: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.headline,
    description: article.description,
    url: article.url,
    inLanguage: "zh-CN",
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      "@type": "Organization",
      name: article.author
    },
    reviewedBy: {
      "@type": "Organization",
      name: article.reviewer
    },
    publisher: { "@id": `${siteUrl}/#organization` },
    mainEntityOfPage: article.url
  };
}
