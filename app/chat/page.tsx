import { Suspense } from "react";
import type { Metadata } from "next";
import { ChatClient } from "@/components/chat-client";
import { absoluteUrl, breadcrumbJsonLd, faqJsonLd, jsonLd, siteName } from "@/lib/seo";

type ChatModule = "mentor" | "encyclopedia" | "shopping";

const moduleMeta: Record<ChatModule, { title: string; description: string }> = {
  mentor: {
    title: "AI 闻香导师",
    description: "按使用场景、香韵偏好和熏闻方式生成沉香产区、温度、香席与风险边界建议。"
  },
  encyclopedia: {
    title: "AI 沉香百科",
    description: "基于沉香产品知识库和馆藏资料回答产区、工艺、保养、鉴别和熏闻问题。"
  },
  shopping: {
    title: "AI 沉香导购 Agent",
    description: "按预算、用途、产品形态和购买风险偏好推荐沉香香材、线香、手串与收藏候选。"
  }
};

const faqItems = [
  {
    question: "AI 闻香导师需要输入哪些信息？",
    answer: "选择使用场景、偏好香韵、熏闻方式和气味强度即可，也可以补充预算、空间大小或送礼对象。"
  },
  {
    question: "导购 Agent 如何给出推荐？",
    answer: "系统会把用户偏好转换为预算层级、产品类型、香韵标签和风险边界，再匹配商品库中的候选产品。"
  },
  {
    question: "沉香百科回答是否有来源？",
    answer: "百科模块会从知识库检索相关内容，并在回答侧栏显示知识来源和相似度。"
  }
];

function normalizeModule(value?: string | string[]): ChatModule {
  const mod = Array.isArray(value) ? value[0] : value;
  return mod === "encyclopedia" || mod === "shopping" || mod === "mentor" ? mod : "mentor";
}

export function generateMetadata({
  searchParams
}: {
  searchParams?: { module?: string | string[] };
}): Metadata {
  const mod = normalizeModule(searchParams?.module);
  const meta = moduleMeta[mod];
  const canonicalPath = mod === "mentor" ? "/chat" : `/chat?module=${mod}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: absoluteUrl(canonicalPath)
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: absoluteUrl(canonicalPath)
    },
    twitter: {
      title: meta.title,
      description: meta.description
    }
  };
}

export default function ChatPage() {
  const structuredData = [
    breadcrumbJsonLd([
      { name: siteName, url: absoluteUrl("/") },
      { name: "AI 闻香与导购", url: absoluteUrl("/chat") }
    ]),
    faqJsonLd(faqItems)
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData)} />
      <Suspense fallback={null}>
        <ChatClient />
      </Suspense>
    </>
  );
}
