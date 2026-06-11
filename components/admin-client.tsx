"use client";

import * as React from "react";
import { Database, FileText, FileUp, MapPinned, PackagePlus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiPath } from "@/lib/client-paths";
import type { Product, ProductType, Region } from "@/lib/types";

type KnowledgeDocument = {
  id: string;
  title: string;
  sourceName?: string;
  chunks: number;
  createdAt: string;
  readOnly?: boolean;
};

type JsonRecord = Record<string, any>;

const productTypeLabels: Record<ProductType, string> = {
  wood: "香材",
  bracelet: "手串",
  powder: "香粉",
  incense: "线香",
  object: "摆件",
  investment: "收藏级"
};

export function AdminClient() {
  const [uploadStatus, setUploadStatus] = React.useState("");
  const [productImportStatus, setProductImportStatus] = React.useState("");
  const [regionImportStatus, setRegionImportStatus] = React.useState("");
  const [knowledgeMode, setKnowledgeMode] = React.useState("");
  const [productMode, setProductMode] = React.useState("");
  const [regionMode, setRegionMode] = React.useState("");
  const [knowledgeDocuments, setKnowledgeDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [productQuery, setProductQuery] = React.useState("");

  React.useEffect(() => {
    void loadKnowledgeDocuments();
    void loadProducts();
    void loadRegions();
  }, []);

  const filteredProducts = React.useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.region, product.description, product.scentTags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [productQuery, products]);

  async function loadKnowledgeDocuments() {
    const { ok, json } = await fetchJson(apiPath("/api/knowledge/documents"), { cache: "no-store" });
    if (ok) {
      setKnowledgeDocuments(json.documents ?? []);
      setKnowledgeMode(json.mode ?? "");
    } else {
      setUploadStatus(json.error ?? "读取知识库失败。");
    }
  }

  async function loadProducts() {
    const { ok, json } = await fetchJson(apiPath("/api/products"), { cache: "no-store" });
    if (ok) {
      setProducts(json.products ?? []);
      setProductMode(json.mode ?? "");
    } else {
      setProductImportStatus(json.error ?? "读取商品失败。");
    }
  }

  async function loadRegions() {
    const { ok, json } = await fetchJson(apiPath("/api/regions"), { cache: "no-store" });
    if (ok) {
      setRegions(json.regions ?? []);
      setRegionMode(json.mode ?? "");
    } else {
      setRegionImportStatus(json.error ?? "读取产区失败。");
    }
  }

  async function uploadKnowledge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploadStatus("正在切片并生成 embedding...");
    const { ok, json } = await fetchJson(apiPath("/api/knowledge/upload"), {
      method: "POST",
      body: new FormData(form)
    });
    setUploadStatus(ok ? knowledgeUploadMessage(json) : json.error ?? "上传失败。");
    if (ok) {
      form.reset();
      await loadKnowledgeDocuments();
    }
  }

  async function deleteKnowledgeDocument(document: KnowledgeDocument) {
    const confirmed = window.confirm(`确定移除「${document.title}」吗？删除后对应知识片段也会移除。`);
    if (!confirmed) return;

    setUploadStatus(`正在删除：${document.title}...`);
    const { ok, json } = await fetchJson(apiPath(`/api/knowledge/documents/${document.id}`), {
      method: "DELETE"
    });
    setUploadStatus(ok ? `已删除：${document.title}（${json.mode}）` : json.error ?? "删除失败。");
    if (ok) await loadKnowledgeDocuments();
  }

  async function importProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setProductImportStatus("正在解析并导入商品...");
    const { ok, json } = await fetchJson(apiPath("/api/products/import"), {
      method: "POST",
      body: new FormData(form)
    });
    setProductImportStatus(ok ? importMessage(json, "商品") : json.error ?? "导入失败。");
    if (ok) {
      form.reset();
      await loadProducts();
    }
  }

  async function importRegions(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setRegionImportStatus("正在解析并导入产区资料...");
    const { ok, json } = await fetchJson(apiPath("/api/regions/import"), {
      method: "POST",
      body: new FormData(form)
    });
    setRegionImportStatus(ok ? importMessage(json, "产区") : json.error ?? "导入失败。");
    if (ok) {
      form.reset();
      await loadRegions();
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Nav />
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit">
            <Database className="mr-1 h-3.5 w-3.5" />
            管理后台
          </Badge>
          <h1 className="text-3xl font-semibold tracking-normal">资料与知识库管理</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            批量上传知识库、商品和产区资料。重复资料会优先更新已有记录，避免同一批材料反复追加成多份。
          </p>
        </div>

        <Tabs defaultValue="knowledge" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="knowledge">知识库</TabsTrigger>
            <TabsTrigger value="products">商品</TabsTrigger>
            <TabsTrigger value="regions">产区</TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileUp className="h-5 w-5" />
                    批量上传资料
                  </CardTitle>
                  <CardDescription>支持 Markdown、TXT、PDF。文件名相同或标题相同会更新原资料。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={uploadKnowledge}>
                    <Input name="file" type="file" accept=".md,.markdown,.txt,.pdf" multiple required />
                    <Button type="submit">
                      <FileUp className="mr-2 h-4 w-4" />
                      上传到 RAG
                    </Button>
                  </form>
                  <StatusText>{uploadStatus}</StatusText>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      已入库资料
                    </CardTitle>
                    <CardDescription>
                      {knowledgeDocuments.length} 份资料，当前模式：{knowledgeMode || "读取中"}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => void loadKnowledgeDocuments()} aria-label="刷新资料">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid max-h-[520px] gap-3 overflow-auto pr-1">
                    {knowledgeDocuments.length === 0 ? (
                      <EmptyState text="暂无已入库资料。" />
                    ) : (
                      knowledgeDocuments.map((document) => (
                        <div key={document.id} className="rounded-lg border bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{document.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {document.sourceName || "未记录来源文件"} · {document.chunks} 个片段 ·{" "}
                                {formatDate(document.createdAt)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => void deleteKnowledgeDocument(document)}
                              aria-label="删除资料"
                              disabled={document.readOnly}
                              title={document.readOnly ? "LLM Wiki 自动维护的页面不能在后台删除" : "删除资料"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PackagePlus className="h-5 w-5" />
                    批量导入商品
                  </CardTitle>
                  <CardDescription>支持 Excel、Markdown、TXT。重复商品按名称、产区和类型更新。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={importProducts}>
                    <Input name="file" type="file" accept=".xlsx,.xls,.md,.markdown,.txt,.csv,.tsv" multiple required />
                    <Button type="submit">
                      <FileUp className="mr-2 h-4 w-4" />
                      导入商品
                    </Button>
                  </form>
                  <StatusText>{productImportStatus}</StatusText>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">商品列表</CardTitle>
                      <CardDescription>
                        {products.length} 个商品，当前模式：{productMode || "读取中"}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => void loadProducts()} aria-label="刷新商品">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                      placeholder="搜索名称、产区、描述或香气标签"
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid max-h-[520px] gap-3 overflow-auto pr-1">
                    {filteredProducts.length === 0 ? (
                      <EmptyState text="暂无匹配商品。" />
                    ) : (
                      filteredProducts.map((product) => (
                        <div key={product.id} className="rounded-lg border bg-card p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{product.name}</p>
                            <Badge variant="outline">{productTypeLabels[product.type]}</Badge>
                            <Badge variant="secondary">{product.region}</Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{product.scentTags.join("、") || "暂无香气标签"}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="regions" className="mt-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPinned className="h-5 w-5" />
                    批量导入产区
                  </CardTitle>
                  <CardDescription>支持 Excel、Markdown、TXT。重复产区按名称更新。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={importRegions}>
                    <Input name="file" type="file" accept=".xlsx,.xls,.md,.markdown,.txt,.csv,.tsv" multiple required />
                    <Button type="submit">
                      <FileUp className="mr-2 h-4 w-4" />
                      导入产区
                    </Button>
                  </form>
                  <StatusText>{regionImportStatus}</StatusText>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">产区列表</CardTitle>
                    <CardDescription>
                      {regions.length} 个产区，当前模式：{regionMode || "读取中"}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => void loadRegions()} aria-label="刷新产区">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid max-h-[520px] gap-3 overflow-auto pr-1">
                    {regions.length === 0 ? (
                      <EmptyState text="暂无产区资料。" />
                    ) : (
                      regions.map((region) => (
                        <div key={region.id} className="rounded-lg border bg-card p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{region.name}</p>
                            <Badge variant="secondary">{region.country}</Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{region.aromaCharacter}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {(region.typicalScenes ?? region.scenes ?? []).join("、") || "暂无适用场景"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
}

function StatusText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{children}</p>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function knowledgeUploadMessage(json: JsonRecord) {
  return `已处理 ${json.files ?? 1} 个文件：成功 ${json.succeeded ?? 1} 个，失败 ${json.failed ?? 0} 个，共 ${
    json.chunks ?? 0
  } 个知识片段（${json.mode ?? "unknown"}）`;
}

function importMessage(json: JsonRecord, label: string) {
  const errorTail = Array.isArray(json.errors) && json.errors.length > 0 ? `，${json.errors.length} 条未导入` : "";
  return `已处理 ${json.files ?? 1} 个文件：新增 ${json.createdCount ?? 0} 个${label}，更新 ${
    json.updatedCount ?? 0
  } 个，跳过 ${json.skippedCount ?? 0} 个（${json.mode ?? "unknown"}）${errorTail}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<{ ok: boolean; json: JsonRecord }> {
  const response = await fetch(input, init);
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return { ok: response.ok, json };
}
