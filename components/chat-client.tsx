"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenText, Check, Gem, Loader2, Send, Sparkles, type LucideIcon } from "lucide-react";
import { Nav } from "@/components/nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/client-paths";
import { cn } from "@/lib/utils";
import type { AssistantModule, Recommendation } from "@/lib/types";

type OptionGroup = {
  id: string;
  label: string;
  multiple?: boolean;
  options: string[];
};

type AgentConfig = {
  label: string;
  description: string;
  icon: LucideIcon;
  cta: string;
  otherPlaceholder: string;
  groups: OptionGroup[];
};

type StreamMeta = {
  scentTags?: string[];
  recommendations?: Recommendation[];
  sources?: { title: string; similarity?: number }[];
};

const CLIENT_REQUEST_TIMEOUT_MS = 45000;

const moduleOptions: { value: AssistantModule; label: string }[] = [
  { value: "mentor", label: "闻香导师" },
  { value: "shopping", label: "导购 Agent" },
  { value: "encyclopedia", label: "沉香百科" }
];

const agentConfigs: Record<AssistantModule, AgentConfig> = {
  mentor: {
    label: "AI 闻香导师",
    description: "按场景、香韵和熏闻方式生成香席建议。",
    icon: Sparkles,
    cta: "生成闻香建议",
    otherPlaceholder: "例如：我想给晚间书房用，气味不要太甜，希望比较安静。",
    groups: [
      { id: "scene", label: "使用场景", multiple: true, options: ["茶室", "书房", "静坐", "助眠", "商务空间", "送礼"] },
      { id: "scent", label: "偏好香韵", multiple: true, options: ["清甜", "凉意", "奶韵", "药感", "木质", "花蜜", "清雅"] },
      { id: "method", label: "熏闻方式", options: ["电熏", "隔火", "线香", "随身闻香"] },
      { id: "intensity", label: "气味强度", options: ["轻柔", "平衡", "穿透力强"] }
    ]
  },
  shopping: {
    label: "AI 导购 Agent",
    description: "按预算、用途、产品形态和风险偏好给出购买建议。",
    icon: Gem,
    cta: "生成导购推荐",
    otherPlaceholder: "例如：送长辈，预算三千左右，最好稳妥不容易踩坑。",
    groups: [
      { id: "budget", label: "预算", options: ["500 入门试香", "3000 进阶预算", "20000 高阶预算", "收藏级"] },
      { id: "product", label: "产品类型", multiple: true, options: ["香材", "手串", "香粉", "线香", "摆件", "收藏藏品"] },
      { id: "purpose", label: "用途", multiple: true, options: ["自用", "送礼", "茶室", "商务空间", "收藏"] },
      { id: "risk", label: "购买偏好", options: ["新手稳妥", "愿意小幅升级", "重视稀缺性"] }
    ]
  },
  encyclopedia: {
    label: "AI 沉香百科",
    description: "用知识库口径解释产区、工艺、保养和鉴别问题。",
    icon: BookOpenText,
    cta: "生成百科回答",
    otherPlaceholder: "例如：我想知道惠安系和星洲系在气味上的主要区别。",
    groups: [
      { id: "topic", label: "主题", options: ["产区对比", "香韵解释", "工艺保养", "真假鉴别", "价格等级"] },
      { id: "depth", label: "回答深度", options: ["新手易懂", "进阶细讲", "购买决策辅助"] },
      { id: "focus", label: "关注点", multiple: true, options: ["气味", "来源记录", "检测佐证", "使用方式", "风险边界"] }
    ]
  }
};

function initialSelection(module: AssistantModule) {
  return Object.fromEntries(agentConfigs[module].groups.map((group) => [group.id, [] as string[]]));
}

function getInitialModule(value: string | null): AssistantModule {
  return value === "encyclopedia" || value === "shopping" || value === "mentor" ? value : "mentor";
}

export function ChatClient() {
  const searchParams = useSearchParams();
  const [module, setModule] = useState<AssistantModule>(() => getInitialModule(searchParams.get("module")));
  const [selections, setSelections] = useState<Record<string, string[]>>(() => initialSelection(module));
  const [otherInput, setOtherInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState<StreamMeta>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => activeRequestRef.current?.abort();
  }, []);

  const config = agentConfigs[module];
  const selectedValues = useMemo(() => Object.values(selections).flat(), [selections]);
  const canSubmit = selectedValues.length > 0 || otherInput.trim().length > 0;

  function changeModule(next: string) {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    const nextModule = getInitialModule(next);
    setModule(nextModule);
    setSelections(initialSelection(nextModule));
    setOtherInput("");
    setAnswer("");
    setMeta({});
    setError("");
  }

  function toggleOption(group: OptionGroup, option: string) {
    setSelections((current) => {
      const values = current[group.id] ?? [];
      const nextValues = values.includes(option)
        ? values.filter((item) => item !== option)
        : group.multiple
          ? [...values, option]
          : [option];
      return { ...current, [group.id]: nextValues };
    });
  }

  async function submitPreference() {
    if (!canSubmit || loading) return;

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);

    setLoading(true);
    setError("");
    setAnswer("");
    setMeta({});

    try {
      const response = await fetch(apiPath("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, message: buildPrompt(config, selections, otherInput) }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) throw new Error("推荐生成失败，请稍后再试。");
      await readEventStream(response.body, {
        onMeta: setMeta,
        onToken: (token) => setAnswer((current) => current + token),
        onError: (message) => setError(message)
      });
    } catch (err) {
      if (activeRequestRef.current === controller) {
        setError(
          err instanceof DOMException && err.name === "AbortError"
            ? "本次生成已超时或取消，请重新尝试。"
            : err instanceof Error
              ? err.message
              : "推荐生成失败，请稍后再试。"
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (activeRequestRef.current === controller) {
        activeRequestRef.current = null;
        setLoading(false);
      }
    }
  }

  function cancelPreference() {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setLoading(false);
    setError("本次生成已取消。");
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[390px_1fr]">
        <aside className="space-y-5">
          <div>
            <Badge>Preference First</Badge>
            <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight">选择偏好，让 AI 直接推荐。</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              每个 Agent 都按选项理解需求，也可以在“其他补充”里输入没有覆盖到的细节。
            </p>
          </div>

          <Tabs defaultValue={module} value={module} onValueChange={changeModule}>
            <TabsList className="grid w-full grid-cols-3">
              {moduleOptions.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="px-2">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <PreferencePanel
            config={config}
            selections={selections}
            otherInput={otherInput}
            loading={loading}
            canSubmit={canSubmit}
            onToggle={toggleOption}
            onOtherInput={setOtherInput}
            onSubmit={submitPreference}
            onCancel={cancelPreference}
          />
        </aside>

        <RecommendationPanel module={module} config={config} answer={answer} loading={loading} error={error} meta={meta} />
      </section>
    </main>
  );
}

function PreferencePanel({
  config,
  selections,
  otherInput,
  loading,
  canSubmit,
  onToggle,
  onOtherInput,
  onSubmit,
  onCancel
}: {
  config: AgentConfig;
  selections: Record<string, string[]>;
  otherInput: string;
  loading: boolean;
  canSubmit: boolean;
  onToggle: (group: OptionGroup, option: string) => void;
  onOtherInput: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const Icon = config.icon;

  return (
    <Card className="bg-card/82">
      <CardHeader>
        <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle>{config.label}</CardTitle>
        <CardDescription className="leading-6">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {config.groups.map((group) => (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{group.label}</p>
              <span className="text-xs text-muted-foreground">{group.multiple ? "可多选" : "单选"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {group.options.map((option) => {
                const selected = selections[group.id]?.includes(option) ?? false;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onToggle(group, option)}
                    className={cn(
                      "flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      selected ? "border-primary bg-primary text-primary-foreground" : "bg-background/60 hover:bg-secondary/70"
                    )}
                  >
                    <span>{option}</span>
                    {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <p className="text-sm font-medium">其他补充</p>
          <Textarea
            value={otherInput}
            onChange={(event) => onOtherInput(event.target.value)}
            placeholder={config.otherPlaceholder}
            className="min-h-28 resize-none"
          />
        </div>

        <Button className="w-full" size="lg" disabled={!canSubmit && !loading} onClick={loading ? onCancel : onSubmit}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "停止生成" : config.cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function RecommendationPanel({
  module,
  config,
  answer,
  loading,
  error,
  meta
}: {
  module: AssistantModule;
  config: AgentConfig;
  answer: string;
  loading: boolean;
  error: string;
  meta: StreamMeta;
}) {
  return (
    <section className="min-h-[680px] rounded-lg border bg-card/70 shadow-soft">
      <div className="border-b p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">AI 推荐结果</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold">{config.label}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(meta.scentTags ?? []).slice(0, 5).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_300px]">
        <div className="min-h-[560px] p-5">
          {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
          {!answer && !loading && !error ? (
            <div className="flex min-h-[500px] items-center justify-center text-center">
              <div className="max-w-sm">
                <p className="font-serif text-2xl font-semibold">先选择偏好</p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  这里会展示 AI 根据选项和补充输入生成的建议、说明和风险边界。
                </p>
              </div>
            </div>
          ) : (
            <div className="chat-scrollbar max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-8">
              {answer}
              {loading ? <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-primary align-middle" /> : null}
            </div>
          )}
        </div>

        <aside className="border-t p-5 lg:border-l lg:border-t-0">
          <h3 className="text-sm font-semibold">{module === "encyclopedia" ? "知识来源" : "推荐卡片"}</h3>
          <div className="mt-3 space-y-3">
            {module === "encyclopedia"
              ? (meta.sources ?? []).map((source) => (
                  <div key={`${source.title}-${source.similarity}`} className="rounded-md border bg-background/55 p-3">
                    <p className="text-sm font-medium">{source.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">相似度 {source.similarity?.toFixed(3) ?? "N/A"}</p>
                  </div>
                ))
              : (meta.recommendations ?? []).map((item) => (
                  <div key={item.product.id} className="rounded-md border bg-background/55 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.product.name}</p>
                      <Badge>{item.score}</Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.why}</p>
                  </div>
                ))}
            {!loading && !meta.sources?.length && !meta.recommendations?.length ? (
              <p className="rounded-md border bg-background/55 p-3 text-xs leading-5 text-muted-foreground">
                生成后会同步显示可追溯的来源或候选推荐。
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildPrompt(config: AgentConfig, selections: Record<string, string[]>, otherInput: string) {
  const selectedText = config.groups
    .map((group) => {
      const values = selections[group.id] ?? [];
      return values.length ? `${group.label}：${values.join("、")}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return [`用户通过选项表达了以下偏好：`, selectedText || "未选择固定选项", otherInput.trim() ? `其他补充：${otherInput.trim()}` : ""]
    .filter(Boolean)
    .join("\n");
}

async function readEventStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onMeta: (meta: StreamMeta) => void;
    onToken: (token: string) => void;
    onError: (message: string) => void;
  }
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const lines = event.split("\n");
      const eventName = lines.find((line) => line.startsWith("event: "))?.slice(7);
      const dataLine = lines.find((line) => line.startsWith("data: "));
      if (!dataLine || eventName === "done") continue;
      const data = JSON.parse(dataLine.slice(6));
      if (eventName === "meta") {
        handlers.onMeta(data as StreamMeta);
      } else if (eventName === "error") {
        handlers.onError(typeof data.message === "string" ? data.message : "生成中断，请稍后重试。");
        await reader.cancel();
        return;
      } else if (typeof data.token === "string") {
        handlers.onToken(data.token);
      }
    }
  }
}
