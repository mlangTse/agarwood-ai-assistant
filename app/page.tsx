import Link from "next/link";
import { ArrowRight, BookOpenText, Gem, Sparkles } from "lucide-react";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function Home() {
  return (
    <main className="min-h-screen">
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
                <Link href="/admin">进入管理后台</Link>
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
    </main>
  );
}
