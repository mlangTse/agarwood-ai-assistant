"use client";

import * as React from "react";
import {
  Database,
  FileText,
  FileUp,
  MapPinned,
  PackagePlus,
  Pencil,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal
} from "lucide-react";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/client-paths";
import type { AromaScores, Product, ProductType, Region } from "@/lib/types";

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

const defaultScores: AromaScores = {
  sweetness: 60,
  coolness: 60,
  creaminess: 60,
  medicinal: 60,
  woody: 60,
  penetration: 60,
  longevity: 60,
  beginnerFriendly: 60,
  collectionValue: 40
};

const productTypeLabels: Record<ProductType, string> = {
  wood: "香材",
  bracelet: "手串",
  powder: "香粉",
  incense: "线香",
  object: "摆件",
  investment: "收藏级"
};

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
  const [regionStatus, setRegionStatus] = React.useState("");
  const [regionImportStatus, setRegionImportStatus] = React.useState("");
  const [knowledgeMode, setKnowledgeMode] = React.useState("");
  const [productMode, setProductMode] = React.useState("");
  const [regionMode, setRegionMode] = React.useState("");
  const [knowledgeDocuments, setKnowledgeDocuments] = React.useState<KnowledgeDocument[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [selectedRegion, setSelectedRegion] = React.useState<Region | null>(null);
  const [newScores, setNewScores] = React.useState<AromaScores>(defaultScores);
  const [editScores, setEditScores] = React.useState<AromaScores>(defaultScores);
  const [productQuery, setProductQuery] = React.useState("");
  const [productTypeFilter, setProductTypeFilter] = React.useState("all");
  const [inventoryFilter, setInventoryFilter] = React.useState("all");

  React.useEffect(() => {
    void loadKnowledgeDocuments();
    void loadProducts();
    void loadRegions();
  }, []);

  React.useEffect(() => {
    setEditScores(selectedProduct?.aromaScores ?? defaultScores);
  }, [selectedProduct]);

  const filteredProducts = React.useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        [product.name, product.region, product.description, product.scentTags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesType = productTypeFilter === "all" || product.type === productTypeFilter;
      const matchesInventory = inventoryFilter === "all" || product.inventoryStatus === inventoryFilter;
      return matchesQuery && matchesType && matchesInventory;
    });
  }, [inventoryFilter, productQuery, productTypeFilter, products]);

  async function loadKnowledgeDocuments() {
    const { ok, json } = await fetchJson(apiPath("/api/knowledge/documents"), { cache: "no-store" });
    if (ok) {
      setKnowledgeDocuments(json.documents ?? []);
      setKnowledgeMode(json.mode ?? "");
    }
  }

  async function loadProducts() {
    const { ok, json } = await fetchJson(apiPath("/api/products"), { cache: "no-store" });
    if (ok) {
      setProducts(json.products ?? []);
      setProductMode(json.mode ?? "");
    } else {
      setProductStatus(json.error ?? "读取商品失败。");
    }
  }

  async function loadRegions() {
    const { ok, json } = await fetchJson(apiPath("/api/regions"), { cache: "no-store" });
    if (ok) {
      setRegions(json.regions ?? []);
      setRegionMode(json.mode ?? "");
    } else {
      setRegionStatus(json.error ?? "读取产区失败。");
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
    setUploadStatus(ok ? `已入库：${json.chunks} 个知识片段（${json.mode}）` : json.error);
    if (ok) {
      form.reset();
      await loadKnowledgeDocuments();
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = productPayloadFromForm(new FormData(form), newScores);
    setProductStatus("正在保存商品...");
    const { ok, json } = await fetchJson(apiPath("/api/products"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setProductStatus(ok ? `已保存：${json.product.name}（${json.mode}）` : json.error);
    if (ok) {
      form.reset();
      setNewScores(defaultScores);
      await loadProducts();
    }
  }

  async function updateSelectedProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct) return;
    const payload = productPayloadFromForm(new FormData(event.currentTarget), editScores);
    setProductStatus("正在修改商品...");
    const { ok, json } = await fetchJson(apiPath(`/api/products/${selectedProduct.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setProductStatus(ok ? `已修改：${json.product.name}（${json.mode}）` : json.error);
    if (ok) {
      setSelectedProduct(json.product);
      await loadProducts();
    }
  }

  async function importProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setProductImportStatus("正在解析并导入商品...");
    const { ok, json } = await fetchJson(apiPath("/api/products/import"), {
      method: "POST",
      body: new FormData(form)
    });
    setProductImportStatus(
      ok
        ? `已导入 ${json.createdCount} 个，跳过 ${json.skippedCount} 个重复项（${json.mode}）${
            json.errors?.length ? `；${json.errors.length} 条未导入` : ""
          }`
        : json.error
    );
    if (ok) {
      form.reset();
      await loadProducts();
    }
  }

  async function createRegion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setRegionStatus("正在保存产区...");
    const { ok, json } = await fetchJson(apiPath("/api/regions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regionPayloadFromForm(new FormData(form)))
    });
    setRegionStatus(ok ? `已保存：${json.region.name}（${json.mode}）` : json.error);
    if (ok) {
      form.reset();
      await loadRegions();
    }
  }

  async function updateSelectedRegion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRegion) return;
    setRegionStatus("正在修改产区...");
    const { ok, json } = await fetchJson(apiPath(`/api/regions/${selectedRegion.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(regionPayloadFromForm(new FormData(event.currentTarget)))
    });
    setRegionStatus(ok ? `已修改：${json.region.name}（${json.mode}）` : json.error);
    if (ok) {
      setSelectedRegion(json.region);
      await loadRegions();
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
    setRegionImportStatus(
      ok
        ? `新增 ${json.createdCount} 个，更新 ${json.updatedCount} 个，跳过 ${json.skippedCount} 个（${json.mode}）${
            json.errors?.length ? `；${json.errors.length} 条未导入` : ""
          }`
        : json.error
    );
    if (ok) {
      form.reset();
      await loadRegions();
    }
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
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="knowledge">
              <FileUp className="mr-2 h-4 w-4" />
              知识库上传
            </TabsTrigger>
            <TabsTrigger value="products">
              <PackagePlus className="mr-2 h-4 w-4" />
              商品管理
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
                <CardDescription>支持 Markdown / TXT / PDF，上传后自动切片并写入当前知识库。</CardDescription>
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
            <div className="grid gap-5">
              <Card className="bg-card/82">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>已有商品</CardTitle>
                      <CardDescription>查看、筛选并选择商品进行修改。</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void loadProducts()}>
                      <RefreshCw className="h-4 w-4" />
                      刷新
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                    <label className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="搜索名称、产区、标签" />
                    </label>
                    <Select value={productTypeFilter} onChange={(event) => setProductTypeFilter(event.target.value)}>
                      <option value="all">全部类型</option>
                      {Object.entries(productTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Select value={inventoryFilter} onChange={(event) => setInventoryFilter(event.target.value)}>
                      <option value="all">全部库存</option>
                      <option value="in_stock">在售</option>
                      <option value="limited">少量</option>
                      <option value="archived">下架</option>
                    </Select>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_96px_112px_88px] gap-3 border-b bg-secondary/45 px-4 py-2 text-xs font-medium text-muted-foreground">
                        <span>商品</span>
                        <span>产区</span>
                        <span>类型</span>
                        <span>价格</span>
                        <span>状态</span>
                      </div>
                      <div className="max-h-[420px] divide-y overflow-y-auto">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            className="grid w-full grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_96px_112px_88px] gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/35"
                            onClick={() => setSelectedProduct(product)}
                          >
                            <span className="truncate font-medium">{product.name}</span>
                            <span className="truncate text-muted-foreground">{product.region}</span>
                            <span>{productTypeLabels[product.type]}</span>
                            <span>{formatPrice(product.priceCents)}</span>
                            <InventoryBadge status={product.inventoryStatus} />
                          </button>
                        ))}
                        {filteredProducts.length === 0 && <p className="px-4 py-6 text-sm text-muted-foreground">没有匹配的商品。</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      共 {filteredProducts.length} / {products.length} 个商品
                    </span>
                    {productMode && <Badge>{productMode}</Badge>}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <ProductForm
                  title="新增商品"
                  description="用于导购 Agent 推荐和风险提示。"
                  scores={newScores}
                  setScores={setNewScores}
                  onSubmit={createProduct}
                  submitLabel="保存商品"
                />
                {selectedProduct ? (
                  <ProductForm
                    key={productFormKey(selectedProduct)}
                    title="修改商品"
                    description={selectedProduct.name}
                    product={selectedProduct}
                    scores={editScores}
                    setScores={setEditScores}
                    onSubmit={updateSelectedProduct}
                    submitLabel="保存修改"
                  />
                ) : (
                  <Card className="bg-card/82">
                    <CardHeader>
                      <CardTitle>修改商品</CardTitle>
                      <CardDescription>从上方商品列表中选择一项后编辑。</CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>

              <Card className="bg-card/82">
                <CardHeader>
                  <CardTitle>批量导入商品</CardTitle>
                  <CardDescription>支持 Excel / CSV / Markdown / TXT。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={importProducts}>
                    <Input
                      name="file"
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv,.md,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/markdown,text/plain"
                      required
                    />
                    <Button className="w-fit" type="submit">
                      <FileUp className="h-4 w-4" />
                      导入商品
                    </Button>
                  </form>
                  {(productStatus || productImportStatus) && (
                    <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
                      {productStatus && <p>{productStatus}</p>}
                      {productImportStatus && <p>{productImportStatus}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="regions">
            <div className="grid gap-5">
              <Card className="bg-card/82">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>产区资料</CardTitle>
                      <CardDescription>维护结构化产区档案，供后台和前台读取。</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {regionMode && <Badge>{regionMode}</Badge>}
                      <Button variant="outline" size="sm" onClick={() => void loadRegions()}>
                        <RefreshCw className="h-4 w-4" />
                        刷新
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {regions.map((region) => (
                      <button
                        key={region.id}
                        type="button"
                        className="rounded-md border bg-background/55 p-4 text-left transition-colors hover:bg-secondary/35"
                        onClick={() => setSelectedRegion(region)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{region.name}</p>
                            <p className="text-xs text-muted-foreground">{region.country || "未标注国家/地区"}</p>
                          </div>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{region.aromaCharacter}</p>
                      </button>
                    ))}
                    {regions.length === 0 && <p className="text-sm text-muted-foreground">还没有产区资料。</p>}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 lg:grid-cols-2">
                <RegionForm title="添加产区" onSubmit={createRegion} submitLabel="保存产区" />
                {selectedRegion ? (
                  <RegionForm key={regionFormKey(selectedRegion)} title="修改产区" region={selectedRegion} onSubmit={updateSelectedRegion} submitLabel="保存修改" />
                ) : (
                  <Card className="bg-card/82">
                    <CardHeader>
                      <CardTitle>修改产区</CardTitle>
                      <CardDescription>从上方产区列表中选择一项后编辑。</CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>

              <Card className="bg-card/82">
                <CardHeader>
                  <CardTitle>批量导入产区</CardTitle>
                  <CardDescription>支持 Excel / CSV / Markdown / TXT，字段包含名称、国家/地区、香韵特点、典型场景、风险提示。</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid gap-4" onSubmit={importRegions}>
                    <Input
                      name="file"
                      type="file"
                      accept=".xlsx,.xls,.csv,.tsv,.md,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/markdown,text/plain"
                      required
                    />
                    <Button className="w-fit" type="submit">
                      <FileUp className="h-4 w-4" />
                      导入产区
                    </Button>
                  </form>
                  {(regionStatus || regionImportStatus) && (
                    <div className="mt-4 grid gap-1 text-sm text-muted-foreground">
                      {regionStatus && <p>{regionStatus}</p>}
                      {regionImportStatus && <p>{regionImportStatus}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function ProductForm({
  title,
  description,
  product,
  scores,
  setScores,
  onSubmit,
  submitLabel
}: {
  title: string;
  description: string;
  product?: Product;
  scores: AromaScores;
  setScores: React.Dispatch<React.SetStateAction<AromaScores>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={onSubmit}>
      <Card className="bg-card/82">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="name" placeholder="商品名称" defaultValue={product?.name} required />
            <Input name="region" placeholder="产区，例如 惠安系 / 达拉干" defaultValue={product?.region} required />
            <Input name="priceYuan" type="number" step="0.01" placeholder="价格（元）" defaultValue={product ? product.priceCents / 100 : ""} required />
            <Select name="budgetLevel" defaultValue={product?.budgetLevel ?? "3000"}>
              <option value="500">500 元</option>
              <option value="3000">3000 元</option>
              <option value="20000">2 万元</option>
              <option value="collector">收藏级</option>
            </Select>
            <Select name="type" defaultValue={product?.type ?? "wood"}>
              {Object.entries(productTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select name="inventoryStatus" defaultValue={product?.inventoryStatus ?? "in_stock"}>
              <option value="in_stock">在售</option>
              <option value="limited">少量</option>
              <option value="archived">下架</option>
            </Select>
          </div>
          <Input name="scentTags" placeholder="香韵标签，逗号分隔" defaultValue={product?.scentTags.join("，")} />
          <Textarea name="description" placeholder="商品描述" defaultValue={product?.description} />
          <Textarea name="suitableFor" placeholder="适合人群 / 场景，逗号分隔" defaultValue={product?.suitableFor.join("，")} />
          <Textarea name="riskNotes" placeholder="风险点，逗号分隔" defaultValue={product?.riskNotes.join("，")} />
          <Button className="w-fit" type="submit">
            <Save className="h-4 w-4" />
            {submitLabel}
          </Button>
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
  );
}

function RegionForm({
  title,
  region,
  onSubmit,
  submitLabel
}: {
  title: string;
  region?: Region;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
}) {
  return (
    <Card className="bg-card/82">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>结构化维护产区名称、香韵特点和使用提示。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="name" placeholder="产区名称" defaultValue={region?.name} required />
            <Input name="country" placeholder="国家/地区" defaultValue={region?.country} />
          </div>
          <Textarea name="aromaCharacter" placeholder="香韵特点" defaultValue={region?.aromaCharacter} required />
          <Textarea name="typicalScenes" placeholder="典型场景，逗号分隔" defaultValue={region?.typicalScenes.join("，")} />
          <Textarea name="riskNotes" placeholder="风险提示，逗号分隔" defaultValue={region?.riskNotes.join("，")} />
          <Button className="w-fit" type="submit">
            <Save className="h-4 w-4" />
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="h-10 rounded-md border bg-background/70 px-3 text-sm" {...props} />;
}

function InventoryBadge({ status }: { status: Product["inventoryStatus"] }) {
  const label = status === "limited" ? "少量" : status === "archived" ? "下架" : "在售";
  return <Badge>{label}</Badge>;
}

function productFormKey(product: Product) {
  return [
    product.id,
    product.name,
    product.type,
    product.region,
    product.priceCents,
    product.budgetLevel,
    product.inventoryStatus,
    product.description,
    product.riskNotes.join("|"),
    product.suitableFor.join("|"),
    product.scentTags.join("|"),
    ...scoreFields.map(([key]) => product.aromaScores[key])
  ].join("::");
}

function regionFormKey(region: Region) {
  return [
    region.id,
    region.name,
    region.country,
    region.aromaCharacter,
    region.typicalScenes.join("|"),
    region.riskNotes.join("|")
  ].join("::");
}

function productPayloadFromForm(data: FormData, scores: AromaScores) {
  const priceYuan = Number(textValue(data, "priceYuan", "0"));
  return {
    name: textValue(data, "name"),
    type: textValue(data, "type", "wood"),
    region: textValue(data, "region"),
    priceCents: Number.isFinite(priceYuan) ? Math.round(priceYuan * 100) : 0,
    budgetLevel: textValue(data, "budgetLevel", "3000"),
    description: textValue(data, "description"),
    riskNotes: splitList(textValue(data, "riskNotes")),
    suitableFor: splitList(textValue(data, "suitableFor")),
    scentTags: splitList(textValue(data, "scentTags")),
    aromaScores: scores,
    inventoryStatus: textValue(data, "inventoryStatus", "in_stock")
  };
}

function regionPayloadFromForm(data: FormData) {
  return {
    name: textValue(data, "name"),
    country: textValue(data, "country"),
    aromaCharacter: textValue(data, "aromaCharacter"),
    typicalScenes: splitList(textValue(data, "typicalScenes")),
    riskNotes: splitList(textValue(data, "riskNotes"))
  };
}

function textValue(data: FormData, name: string, fallback = "") {
  return String(data.get(name) ?? fallback).trim();
}

function splitList(value: string) {
  return value
    .split(/[,，、;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${response.status}` };
  }
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await fetch(input, init);
    return {
      ok: response.ok,
      json: await readJson(response)
    };
  } catch (error) {
    return {
      ok: false,
      json: {
        error: error instanceof Error ? `请求失败：${error.message}` : "请求失败，请检查网络或稍后重试。"
      }
    };
  }
}

function formatPrice(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
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
