"use client";

import * as React from "react";
import { Database, FileText, FileUp, MapPinned, PackagePlus, SlidersHorizontal } from "lucide-react";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/client-paths";

const scoreFields = [
  ["sweetness", "甜感"],
  ["coolness", "凉感"],
  ["creaminess", "奶韵"],
  ["medicinal", "药感"],
  ["woody", "木质感"],
  ["penetration", "穿透力"],
  ["longevity", "留香"],
  ["beginnerFriendly", "新手友好度"],
  ["collectionValue", "收藏价值"]
] as const;

type KnowledgeDocument = {
  id: string;
  title: string;
  sourceName?: string;
  chunks: number;
  createdAt: string;
};

export function AdminClient() {
  const [uploadStatus, setUploadStatus] = React.useState("");
  const [productStatus, setProductStatus] = React.useState("");
  const [productImportStatus, setProductImportStatus] = React.useState("");
  const [knowledgeMode, setKnowledgeMode] = React.useState("");
  const [knowledgeDocuments, setKnowledgeDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [scores, setScores] = React.useState<Record<string, number>>(
    Object.fromEntries(scoreFields.map(([key]) => [key, 60]))
  );

  React.useEffect(() => {
    void loadKnowledgeDocuments();
  }, []);

  async function loadKnowledgeDocuments() {
    const response = await fetch(apiPath("/api/knowledge/documents"), { cache: "no-store" });
    const json = await response.json();
    if (response.ok) {
      setKnowledgeDocuments(json.documents ?? []);
      setKnowledgeMode(json.mode ?? "");
    }
  }

  async function uploadKnowledge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setUploadStatus("正在切片与生成 embedding...");
    
    const response = await fetch(apiPath("/api/knowledge/upload"), {
      method: "POST",
      body: formData,
    });
    
    const text = await response.text();
    
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {
        error: text || "服务器返回了非 JSON 内容",
      };
    }
    
    setUploadStatus(
      response.ok
        ? `已入库：${json.chunks} 个知识片段（${json.mode}）`
        : json.error || `上传失败：HTTP ${response.status}`
    );
    
    if (response.ok) {
      form.reset();
      await loadKnowledgeDocuments();
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") ?? ""),
      type: String(data.get("type") ?? "wood"),
      region: String(data.get("region") ?? ""),
      priceCents: Math.round(Number(data.get("priceYuan") ?? 0) * 100),
      budgetLevel: String(data.get("budgetLevel") ?? "3000"),
      description: String(data.get("description") ?? ""),
      riskNotes: splitList(String(data.get("riskNotes") ?? "")),
      suitableFor: splitList(String(data.get("suitableFor") ?? "")),
      scentTags: splitList(String(data.get("scentTags") ?? "")),
      aromaScores: scores
    };
    setProductStatus("正在保存商品...");
    const response = await fetch(apiPath("/api/products"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    setProductStatus(response.ok ? `已保存：${json.product.name ?? payload.name}（${json.mode}）` : json.error);
    if (response.ok) form.reset();
  }

  async function importProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setProductImportStatus("正在解析并导入商品...");

    const response = await fetch(apiPath("/api/products/import"), {
      method: "POST",
      body: formData
    });
    const json = await response.json();
    setProductImportStatus(
      response.ok
        ? `已导入 ${json.createdCount} 个，跳过 ${json.skippedCount} 个重复项（${json.mode}）${
            json.errors?.length ? `；${json.errors.length} 条未导入` : ""
          }`
        : json.error
    );

    if (response.ok) form.reset();
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge>Admin Console</Badge>
            <h1 className="mt-3 font-serif text-4xl font-semibold">沉香知识与商品中台</h1>
          </div>
          <div className="flex gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4" />
            PostgreSQL / RAG / Product Aroma Scores
          </div>
        </div>

        <Tabs defaultValue="knowledge">
          <TabsList>
            <TabsTrigger value="knowledge">
              <FileUp className="mr-2 h-4 w-4" />
              知识库上传
            </TabsTrigger>
            <TabsTrigger value="products">
              <PackagePlus className="mr-2 h-4 w-4" />
              商品录入
            </TabsTrigger>
            <TabsTrigger value="regions">
              <MapPinned className="mr-2 h-4 w-4" />
              产区资料
            </TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge">
            <Card className="bg-card/82">
              <CardHeader>
                <CardTitle>知识库上传</CardTitle>
                <CardDescription>支持 Markdown / TXT / PDF，上传后自动切片并写入当前知识库；未配置 PostgreSQL 时保存到本地文件。</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={uploadKnowledge}>
                  <Input name="file" type="file" accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf" required />
                  <Button className="w-fit" type="submit">
                    <FileUp className="h-4 w-4" />
                    上传并入库
                  </Button>
                </form>
                {uploadStatus && <p className="mt-4 text-sm text-muted-foreground">{uploadStatus}</p>}
                <div className="mt-6 rounded-md border bg-background/45">
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4" />
                      已入库资料
                    </div>
                    {knowledgeMode && <Badge>{knowledgeMode}</Badge>}
                  </div>
                  <div className="divide-y">
                    {knowledgeDocuments.length > 0 ? (
                      knowledgeDocuments.map((document) => (
                        <div key={document.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <p className="font-medium">{document.title}</p>
                            <p className="text-xs text-muted-foreground">{document.sourceName ?? "后台上传资料"}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {document.chunks} 个片段 · {formatDate(document.createdAt)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="px-4 py-5 text-sm text-muted-foreground">还没有可检索的知识库记录。</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card className="mb-5 bg-card/82">
              <CardHeader>
                <CardTitle>批量导入商品</CardTitle>
                <CardDescription>支持 Excel / CSV / Markdown / TXT。可直接上传由产品表整理出的 Markdown 商品块。</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={importProducts}>
                  <Input
                    name="file"
                    type="file"
                    accept=".xlsx,.xls,.csv,.tsv,.md,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/markdown,text/plain"
                    required
                  />
                  <div className="grid gap-2 text-xs leading-6 text-muted-foreground">
                    <p>推荐字段：商品名称、产品类型、产区、零售价、预算层级、香韵/场景标签、产品介绍、风险提示、适合场景。</p>
                    <p>Markdown 支持“### 商品名”加“- 字段：值”的格式；重复商品会自动跳过。</p>
                  </div>
                  <Button className="w-fit" type="submit">
                    <FileUp className="h-4 w-4" />
                    导入商品
                  </Button>
                  {productImportStatus && <p className="text-sm text-muted-foreground">{productImportStatus}</p>}
                </form>
              </CardContent>
            </Card>

            <form className="grid gap-5 lg:grid-cols-[1fr_380px]" onSubmit={createProduct}>
              <Card className="bg-card/82">
                <CardHeader>
                  <CardTitle>商品录入</CardTitle>
                  <CardDescription>用于导购 Agent 推荐和风险提示。</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="name" placeholder="商品名称" required />
                    <Input name="region" placeholder="产区，例如 惠安系 / 达拉干" required />
                    <Input name="priceYuan" type="number" placeholder="价格（元）" required />
                    <select name="budgetLevel" className="h-10 rounded-md border bg-background/70 px-3 text-sm">
                      <option value="500">500 元</option>
                      <option value="3000">3000 元</option>
                      <option value="20000">2 万元</option>
                      <option value="collector">收藏级</option>
                    </select>
                    <select name="type" className="h-10 rounded-md border bg-background/70 px-3 text-sm">
                      <option value="wood">香材</option>
                      <option value="bracelet">手串</option>
                      <option value="powder">香粉</option>
                      <option value="incense">线香</option>
                      <option value="object">摆件</option>
                      <option value="investment">投资级收藏</option>
                    </select>
                    <Input name="scentTags" placeholder="香韵标签，逗号分隔" />
                  </div>
                  <Textarea name="description" placeholder="商品描述" />
                  <Textarea name="suitableFor" placeholder="适合人群 / 场景，逗号分隔" />
                  <Textarea name="riskNotes" placeholder="风险点，逗号分隔" />
                  <Button className="w-fit" type="submit">
                    <PackagePlus className="h-4 w-4" />
                    保存商品
                  </Button>
                  {productStatus && <p className="text-sm text-muted-foreground">{productStatus}</p>}
                </CardContent>
              </Card>

              <Card className="bg-card/82">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal className="h-5 w-5" />
                    香韵评分
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {scoreFields.map(([key, label]) => (
                    <label key={key} className="grid gap-2 text-sm">
                      <span className="flex justify-between">
                        {label}
                        <strong>{scores[key]}</strong>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={scores[key]}
                        onChange={(event) => setScores((prev) => ({ ...prev, [key]: Number(event.target.value) }))}
                      />
                    </label>
                  ))}
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="regions">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ["惠安系", "甜润、花蜜、层次细，适合茶席与静坐。"],
                ["星洲系", "木质、凉感、穿透力强，适合空间导览。"],
                ["海南", "文化叙事强，雅正温润，适合文博馆展陈。"]
              ].map(([name, desc]) => (
                <Card key={name} className="bg-card/82">
                  <CardHeader>
                    <CardTitle>{name}</CardTitle>
                    <CardDescription className="leading-7">{desc}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function splitList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
