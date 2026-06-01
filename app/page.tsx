import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpenText, Gem, Sparkles } from "lucide-react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  absoluteUrl,
  breadcrumbJsonLd,
  defaultDescription,
  faqJsonLd,
  jsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  productJsonLd,
  siteName,
  websiteJsonLd
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "沉香 AI 闻香、百科与导购 Agent",
  description: defaultDescription,
  alternates: {
    canonical: absoluteUrl("/")
  },
  openGraph: {
    title: "沉香 AI 闻香、百科与导购 Agent",
    description: defaultDescription,
    url: absoluteUrl("/")
  },
  twitter: {
    title: "沉香 AI 闻香、百科与导购 Agent",
    description: defaultDescription
  }
};

const entries = [
  {
    title: "AI 闻香导师",
    desc: "从甜、凉、奶韵、药感与空间场景出发，给出产区、温度和香席建议。",
    icon: Sparkles,
    href: "/chat?module=mentor"
  },
  {
    title: "AI 沉香百科",
    desc: "基于馆藏和品牌知识库回答产区、工艺、保养、鉴别与熏闻问题。",
    icon: BookOpenText,
    href: "/chat?module=encyclopedia"
  },
  {
    title: "AI 导购 Agent",
    desc: "按预算、用途和心理门槛推荐香材、手串、线香、摆件与收藏级藏品。",
    icon: Gem,
    href: "/chat?module=shopping"
  }
];

const faqItems = [
  {
    question: "沉香 AI 助手适合什么场景？",
    answer: "适合文博馆导览、品牌展厅讲解、私域导购、茶室闻香建议和沉香知识库问答。"
  },
  {
    question: "导购推荐会直接替代人工鉴定吗？",
    answer: "不会。AI 会根据预算、用途、香韵偏好和风险边界给出候选建议，贵重藏品仍需来源、检测和长期复闻记录。"
  },
  {
    question: "百科回答的内容来源是什么？",
    answer: "百科模块基于后台上传的沉香产品知识库和馆藏资料检索回答，并在结果侧栏展示可追溯来源。"
  }
];

const comparisonRows = [
  ["惠安系", "甜润、花蜜、清透", "茶室、静坐、夜读", "适合低温细闻，避免高温猛熏"],
  ["星洲系", "木质、凉感、穿透力较强", "办公室、商务空间、展厅", "适合想快速感知产区差异的新手"],
  ["海南", "雅正、温润、文化属性强", "文博馆、雅集、礼赠", "适合讲解沉香文化与礼赠场景"]
];

export default function Home() {
  const structuredData = [
    organizationJsonLd(),
    websiteJsonLd(),
    localBusinessJsonLd(),
    breadcrumbJsonLd([{ name: siteName, url: absoluteUrl("/") }]),
    faqJsonLd(faqItems),
    productJsonLd({
      name: "海南方条香（SP00239）",
      description: "独立瓶装设计每瓶净重10克，约含小方香20支。香韵带有花果香蜜香，清新甘甜。",
      price: "98",
      category: "线香",
      tags: ["海南", "甜韵", "蜜香", "花香", "助眠静心", "线香"]
    })
  ];

  return (
    <main className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData)} />
      <Nav />
      <section className="ink-wash zen-grid relative overflow-hidden">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <Badge className="mb-6">Agarwood Museum AI Guide</Badge>
            <h1 className="font-serif text-5xl font-semibold leading-tight text-foreground sm:text-7xl">
              不是每一种香，都适合现在的你。
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-muted-foreground">
              AI 为你找到属于你的香韵。
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/chat">
                  开始闻香
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/guide">阅读选香指南</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-lg border bg-card/55 p-6 shadow-soft backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            <div className="grid h-full grid-rows-[auto_1fr] gap-6">
              <div>
                <p className="text-sm text-muted-foreground">今日香席建议</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold">惠安甜韵，低温入席</h2>
              </div>
              <div className="grid content-end gap-3">
                {["80-110 摄氏度", "茶室 / 静坐", "甜韵 / 花蜜 / 清雅"].map((item) => (
                  <div key={item} className="rounded-md border bg-background/55 px-4 py-3 text-sm">
                    {item}
                  </div>
                ))}
                <p className="pt-3 text-sm leading-7 text-muted-foreground">
                  先让香气变慢，再让判断变准。MVP 支持 RAG 知识库、流式回答、推荐卡片和收藏推荐。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-7 max-w-3xl">
          <h2 className="font-serif text-3xl font-semibold">三个 Agent 覆盖沉香咨询主流程</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            从“我适合什么香”到“这个产区怎么理解”，再到“预算内怎么选”，每个入口都连接到相同的知识库和商品数据，方便访客与搜索引擎理解页面主题。
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {entries.map((entry) => {
            const Icon = entry.icon;
            return (
              <Card key={entry.title} className="bg-card/78 transition-transform hover:-translate-y-1">
                <CardHeader>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{entry.title}</CardTitle>
                  <CardDescription className="leading-7">{entry.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={entry.href}>
                      进入
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y bg-card/36">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Badge>AI Search Summary</Badge>
            <h2 className="mt-4 font-serif text-3xl font-semibold">沉香选香的核心判断</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              沉香选择通常先看用途，再看香韵、产区、预算和风险边界。AI 助手把这些维度结构化，让百科问答、导购推荐和展厅讲解保持同一套口径。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" asChild>
                <Link href="/guide">查看完整指南</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/chat?module=encyclopedia">询问沉香百科</Link>
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-background/60">
            <table className="w-full min-w-[680px] text-left text-sm">
              <caption className="sr-only">沉香产区香韵与适用场景对比</caption>
              <thead className="border-b bg-secondary/50">
                <tr>
                  {["产区/体系", "典型香韵", "适合场景", "选择提示"].map((head) => (
                    <th key={head} scope="col" className="px-4 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row[0]} className="border-b last:border-b-0">
                    {row.map((cell) => (
                      <td key={cell} className="px-4 py-3 leading-6 text-muted-foreground">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <h2 className="font-serif text-3xl font-semibold">常见问题</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              这些问答对应真实使用路径，也会以 FAQPage 结构化数据提供给搜索引擎和生成式问答系统。
            </p>
          </div>
          <div className="grid gap-3">
            {faqItems.map((item) => (
              <div key={item.question} className="rounded-lg border bg-card/70 p-5">
                <h3 className="text-base font-semibold">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
