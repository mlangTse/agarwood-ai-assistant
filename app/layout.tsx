import type { Metadata } from "next";
import "./globals.css";
import { defaultDescription, defaultKeywords, siteName, siteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: `${siteName} | 沉香闻香、百科与导购 Agent`,
    template: `%s | ${siteName}`
  },
  description: defaultDescription,
  keywords: defaultKeywords,
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  alternates: {
    canonical: siteUrl
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName,
    url: siteUrl,
    title: `${siteName} | 沉香闻香、百科与导购 Agent`,
    description: defaultDescription
  },
  twitter: {
    card: "summary",
    title: `${siteName} | 沉香闻香、百科与导购 Agent`,
    description: defaultDescription
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  category: "technology"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
