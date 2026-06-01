import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLd,
  productJsonLd,
  siteName
} from "@/lib/seo";

const title = "沉香选香指南：产区、香韵、预算与风险边界";
const description =
  "基于沉香产品知识库整理的选香指南，解释惠安系、星洲系、海南与奇楠等常见口径，并给出导购 Agent 可理解的问答结构。";
const updatedAt = "2026-06-01";

const faqItems = [
  {
    question: "第一次买沉香应该先选产区还是先选产品形态？",
    answer: "建议先确定使用场景和产品形态，例如线香、电熏香粉、香材或手串，再用产区与香韵缩小范围。"
  },
  {
    question: "奇楠是否一定适合新手？",
    answer: "不一定。奇楠常见描述包括凉韵、乳韵、穿透力和层次变化，但高阶产品鉴定门槛较高，新手更适合先从低风险体验款建立嗅觉参照。"
  },
  {
    question: "沉香产品介绍里的养生描述应该如何理解？",
    answer: "页面会把养生类原始描述降级为传统使用场景或体验感受，不把它作为医疗功效承诺。"
  }
];

const guideRows = [
  ["入门体验", "线香、香粉、小祥云香", "甜韵、凉韵、木质", "确认是否无添加、是否适合烟敏感人群"],
  ["茶室与静坐", "惠安系小料、海南线香", "花蜜、清雅、温润", "低温细闻，避免过热导致香气粗糙"],
  ["商务与展厅", "星洲系香粉、穿透力强的线香", "凉感、木质、扩散力", "注意空间大小和通风条件"],
  ["收藏与展陈", "奇楠级熟结藏品、沉水级手串", "乳韵、凉韵、层次变化", "需要来源、检测和长期复闻记录"]
];

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: absoluteUrl("/guide")
  },
  openGraph: {
    type: "article",
    title,
    description,
    url: absoluteUrl("/guide"),
    publishedTime: "2026-05-26T15:45:33+08:00",
    modifiedTime: `${updatedAt}T00:00:00+08:00`
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export default function GuidePage() {
  const structuredData = [
    breadcrumbJsonLd([
      { name: siteName, url: absoluteUrl("/") },
      { name: "沉香选香指南", url: absoluteUrl("/guide") }
    ]),
    articleJsonLd({
      headline: title,
      description,
      url: absoluteUrl("/guide"),
      datePublished: "2026-05-26T15:45:33+08:00",
      dateModified: `${updatedAt}T00:00:00+08:00`,
      author: siteName,
      reviewer: "沉香产品知识库整理流程"
    }),
    faqJsonLd(faqItems),
    productJsonLd({
      name: "奇楠线香【经典】（SP00085）",
      description: "纯天然奇楠沉香粉压制，无添加粘粉，香韵包含清甜、沁蜜和乳香层次。",
      price: "98",
      category: "线香",
      tags: ["奇楠", "甜韵", "蜜香", "凉韵", "奶韵", "助眠静心", "线香"]
    })
  ];

  return (
    <main className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData)} />
      <Nav />
      <article>
        <header className="ink-wash zen-grid border-b">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <Badge>Article · Agarwood Guide</Badge>
            <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight sm:text-6xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-muted-foreground">{description}</p>
            <dl className="mt-7 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div className="rounded-md border bg-background/60 p-3">
                <dt className="font-medium text-foreground">更新日期</dt>
                <dd className="mt-1">{updatedAt}</dd>
              </div>
              <div className="rounded-md border bg-background/60 p-3">
                <dt className="font-medium text-foreground">作者</dt>
                <dd className="mt-1">{siteName}</dd>
              </div>
              <div className="rounded-md border bg-background/60 p-3">
                <dt className="font-medium text-foreground">审阅</dt>
                <dd className="mt-1">沉香产品知识库整理流程</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold">一句话结论</h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            沉香选香不是只看价格或产区，而是把使用场景、香韵偏好、产品形态、预算层级和风险边界放在同一张表里判断。
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {["先定场景，再定形态", "用香韵词描述偏好", "高价藏品必须保留来源和检测记录", "养生描述只作为传统使用语境参考"].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border bg-card/70 p-4 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y bg-card/36">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h2 className="font-serif text-3xl font-semibold">沉香选香对比表</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              这张表把产品知识库中的预算层级、产品类型、香韵标签和风险提示整理成导购 Agent 可检索的决策结构。
            </p>
            <div className="mt-6 overflow-x-auto rounded-lg border bg-background/70">
              <table className="w-full min-w-[760px] text-left text-sm">
                <caption className="sr-only">沉香预算层级、产品形态、香韵和风险边界对比</caption>
                <thead className="border-b bg-secondary/50">
                  <tr>
                    {["需求", "优先形态", "常见香韵", "风险边界"].map((head) => (
                      <th key={head} scope="col" className="px-4 py-3 font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guideRows.map((row) => (
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

        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="font-serif text-3xl font-semibold">定义与检索口径</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              清晰定义能帮助用户、搜索引擎和 AI 摘要系统用同一套词汇理解页面。
            </p>
          </div>
          <div className="grid gap-3">
            <section className="rounded-lg border bg-card/70 p-5">
              <h3 className="text-base font-semibold">香韵</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                香韵是对沉香气味表现的归类，例如甜韵、凉韵、蜜香、奶韵、木质感和药感。
              </p>
            </section>
            <section className="rounded-lg border bg-card/70 p-5">
              <h3 className="text-base font-semibold">产区体系</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                产区体系用于表达气味与文化口径，例如惠安系偏甜润清透，星洲系偏木质与凉感，海南更强调温润与文博叙事。
              </p>
            </section>
            <section className="rounded-lg border bg-card/70 p-5">
              <h3 className="text-base font-semibold">风险边界</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                风险边界包括香精添加、过度医疗化表述、贵重藏品来源不明、手串保养不当和高温猛熏造成的体验偏差。
              </p>
            </section>
          </div>
        </section>

        <section className="border-y bg-card/36">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
            <h2 className="font-serif text-3xl font-semibold">常见问题</h2>
            <div className="mt-6 grid gap-3">
              {faqItems.map((item) => (
                <section key={item.question} className="rounded-lg border bg-background/70 p-5">
                  <h3 className="text-base font-semibold">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.answer}</p>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold">来源与下一步</h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            本文依据仓库内 <code>knowledge/agarwood-products.md</code> 的沉香产品知识库整理，该文件由产品 Excel
            生成，包含 132 个产品/包装条目、产品介绍、规格、价格、预算层级和香韵/场景标签。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/chat?module=shopping">
                用导购 Agent 选香
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/chat?module=encyclopedia">继续问沉香百科</Link>
            </Button>
          </div>
        </section>
      </article>
    </main>
  );
}
