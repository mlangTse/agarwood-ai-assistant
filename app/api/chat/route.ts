import { NextRequest } from "next/server";
import { z } from "zod";
import { readCompatibleModelStream, streamChatCompletion } from "@/lib/model-api";
import { mentorPrompt, ragUserPrompt, shoppingPrompt, systemPrompt } from "@/lib/prompts/agents";
import { recommendProducts, inferUserPreference } from "@/lib/recommendation";
import { listProducts } from "@/lib/products";
import { retrieveKnowledge } from "@/lib/rag";
import { sampleProducts } from "@/lib/sample-data";
import type { AssistantModule, KnowledgeChunk, Product, Recommendation } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 40;

const CHAT_TIMEOUT_MS = Number.parseInt(process.env.CHAT_TIMEOUT_MS ?? "35000", 10);

const requestSchema = z.object({
  module: z.enum(["mentor", "encyclopedia", "shopping"]),
  message: z.string().min(1),
  conversationId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const body = requestSchema.parse(await request.json());
  const context = await withTimeout(buildContext(body.module, body.message), 15_000, "上下文生成超时").catch(() =>
    buildLocalContext(body.module, body.message)
  );

  try {
    const modelController = new AbortController();
    request.signal.addEventListener("abort", () => modelController.abort(), { once: true });

    const stream = await streamChatCompletion({
      temperature: body.module === "encyclopedia" ? 0.25 : 0.68,
      signal: modelController.signal,
      messages: [
        { role: "system", content: systemPrompt(body.module) },
        { role: "user", content: context.prompt }
      ]
    });

    if (!stream) return streamFallback(body.module, body.message, context);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let didTimeout = false;
        let isClosed = false;

        const close = () => {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Stream may already be closed by timeout or client abort.
          }
        };

        const enqueue = (payload: string) => {
          if (!isClosed) controller.enqueue(encoder.encode(payload));
        };

        const timeout = setTimeout(() => {
          didTimeout = true;
          modelController.abort();
          enqueue(`event: error\ndata: ${JSON.stringify({ message: "生成超时，请稍后重试。" })}\n\n`);
          close();
        }, CHAT_TIMEOUT_MS);

        try {
          enqueue(`event: meta\ndata: ${JSON.stringify(context.meta)}\n\n`);
          for await (const token of readCompatibleModelStream(stream)) {
            if (request.signal.aborted || isClosed) break;
            if (token) enqueue(`data: ${JSON.stringify({ token })}\n\n`);
          }
          if (!request.signal.aborted && !isClosed) {
            enqueue("event: done\ndata: {}\n\n");
          }
        } catch {
          if (!request.signal.aborted && !didTimeout && !isClosed) {
            enqueue(`event: error\ndata: ${JSON.stringify({ message: "生成中断，请稍后重试。" })}\n\n`);
          }
        } finally {
          clearTimeout(timeout);
          close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch {
    return streamFallback(body.module, body.message, context);
  }
}

async function buildContext(module: AssistantModule, message: string) {
  if (module === "mentor") {
    const preference = inferUserPreference(message);
    const products = await getRecommendableProducts();
    const recommendations = recommendProducts(preference, products, 2);
    return {
      prompt: mentorPrompt(message),
      recommendations,
      fallbackText: buildFallbackText("mentor", message, recommendations),
      meta: {
        scentTags: [...new Set(recommendations.flatMap((item) => item.product.scentTags))],
        recommendations
      }
    };
  }

  if (module === "encyclopedia") {
    const chunks = await retrieveKnowledge(message, 8);
    return {
      prompt: ragUserPrompt(message, chunks),
      recommendations: [] as Recommendation[],
      fallbackText: buildKnowledgeFallbackText(message, chunks),
      meta: {
        scentTags: ["知识库", "RAG", "谨慎回答"],
        sources: chunks.map((chunk) => ({
          title: chunk.title,
          similarity: chunk.similarity,
          sourceName: chunk.metadata?.sourceName
        }))
      }
    };
  }

  const preference = inferUserPreference(message);
  const products = await getRecommendableProducts();
  const recommendations = recommendProducts(preference, products, 3);
  return {
    prompt: shoppingPrompt(message, recommendations),
    recommendations,
    fallbackText: buildFallbackText("shopping", message, recommendations),
    meta: {
      scentTags: [...new Set(recommendations.flatMap((item) => item.product.scentTags))],
      recommendations
    }
  };
}

async function buildLocalContext(module: AssistantModule, message: string) {
  if (module === "encyclopedia") {
    return {
      prompt: ragUserPrompt(message, []),
      recommendations: [] as Recommendation[],
      fallbackText: buildKnowledgeFallbackText(message, []),
      meta: {
        scentTags: ["本地知识库", "知识库未命中", "谨慎回答"],
        sources: []
      }
    };
  }

  const preference = inferUserPreference(message);
  const products = await getRecommendableProducts();
  const recommendations = recommendProducts(preference, products, module === "shopping" ? 3 : 2);
  return {
    prompt: module === "shopping" ? shoppingPrompt(message, recommendations) : mentorPrompt(message),
    recommendations,
    fallbackText: buildFallbackText(module, message, recommendations),
    meta: {
      scentTags: [...new Set(recommendations.flatMap((item) => item.product.scentTags))],
      recommendations
    }
  };
}

async function getRecommendableProducts(): Promise<Product[]> {
  try {
    const result = await listProducts();
    return result.products.length > 0 ? result.products : sampleProducts;
  } catch {
    return sampleProducts;
  }
}

function streamFallback(
  module: AssistantModule,
  message: string,
  context: Awaited<ReturnType<typeof buildContext>> | Awaited<ReturnType<typeof buildLocalContext>>
) {
  const encoder = new TextEncoder();
  const text = context.fallbackText ?? buildFallbackText(module, message, context.recommendations);

  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: meta\ndata: ${JSON.stringify(context.meta)}\n\n`));
      for (const token of text.match(/.{1,12}/g) ?? []) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
      controller.close();
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function buildKnowledgeFallbackText(message: string, chunks: KnowledgeChunk[]) {
  const answerDepth = selectedAnswerDepth(message);
  if (chunks.length === 0) {
    return `我没有在当前知识库里找到足够贴合“${message}”的资料。建议先补充产区来源、树种、结香方式、检测或合法来源证明等材料；补充后我会按知识库概念页回答，并在侧栏展示引用来源。`;
  }

  const uniqueChunks = uniqueKnowledgeChunks(chunks);
  const topChunk = uniqueChunks[0];
  if (isMissingFixedTopicChunk(topChunk)) {
    const topic = typeof topChunk.metadata?.fixedTopic === "string" ? topChunk.metadata.fixedTopic : "未知主题";
    const wikiPath = typeof topChunk.metadata?.wikiPath === "string" ? topChunk.metadata.wikiPath : `concepts/${topic}.md`;
    return `知识库缺少主题页：${topic}。请先补充 ${wikiPath}，不要改用其他页面凑答案。`;
  }
  const primaryChunks = uniqueChunks.filter((chunk) => isPrimaryWikiPage(chunk));

  if (!topChunk || !isPrimaryWikiPage(topChunk) || primaryChunks.length === 0) {
    return [
      `当前知识库没有为“${message}”命中足够可靠的概念页或实体页。`,
      "",
      "我不会把 source 摘录、物种列表或零散片段硬拼成答案。请先补充或整理对应的概念页，例如产区对比、香韵解释、真假鉴别、价格等级，或补充可核对的来源记录、检测资料和合法来源证明。"
    ].join("\n");
  }

  const cleanedChunks = primaryChunks
    .map((chunk) => ({
      title: cleanKnowledgeTitle(chunk.title),
      content: cleanKnowledgeContent(chunk.content)
    }))
    .filter((chunk) => chunk.content.length >= 20)
    .slice(0, 3);

  if (cleanedChunks.length === 0) {
    return `我在知识库里找到了相关概念页，但片段内容不足以组成可靠回答。建议补充更完整的中文整理页，或换一个更具体的问题，例如产区、树种、香韵、结香方式、保护状态或购买风险。`;
  }

  const primary = cleanedChunks[0];
  const primaryContent = removeRepeatedTitle(primary.content, primary.title);

  return [
    depthAwareKnowledgeContent(primaryContent, primary.title, answerDepth),
    "",
    "用于购买、鉴定或对外宣传时，还要结合实物复闻、来源记录、检测资料和合法来源证明。"
  ].join("\n");
}

type AnswerDepth = "beginner" | "advanced" | "decision";

function selectedAnswerDepth(message: string): AnswerDepth {
  if (message.includes("购买决策辅助")) return "decision";
  if (message.includes("进阶细讲")) return "advanced";
  return "beginner";
}

function uniqueKnowledgeChunks(chunks: KnowledgeChunk[]) {
  const seen = new Set<string>();
  const unique: KnowledgeChunk[] = [];
  for (const chunk of chunks) {
    const key = `${cleanKnowledgeTitle(chunk.title)}\n${cleanKnowledgeContent(chunk.content).slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
  }
  return unique;
}

function isPrimaryWikiPage(chunk: KnowledgeChunk) {
  const sourceName = typeof chunk.metadata?.sourceName === "string" ? chunk.metadata.sourceName : "";
  const wikiPath = typeof chunk.metadata?.wikiPath === "string" ? chunk.metadata.wikiPath : "";
  const pathText = `${sourceName}\n${wikiPath}`;
  return /knowledge\/wiki\/(concepts|entities)\//.test(pathText) || /^(concepts|entities)\//.test(pathText);
}

function isMissingFixedTopicChunk(chunk: KnowledgeChunk | undefined) {
  return chunk?.metadata?.fixedTopicMissing === true;
}

function cleanKnowledgeTitle(title: string) {
  return title
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanKnowledgeContent(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^tags:\s*[\s\S]*?(?=\n#|\n##|$)/im, "")
    .replace(/^sources:\s*[\s\S]*?(?=\n#|\n##|$)/im, "")
    .replace(/^date:\s*.+$/gim, "")
    .replace(/\n##\s*相关[\s\S]*$/m, "")
    .replace(/^#+\s*/gm, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?]]/g, "$1")
    .replace(/\[\^[^\]]+]:?.*$/gm, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`>#-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeRepeatedTitle(content: string, title: string) {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return content.replace(new RegExp(`^${escapedTitle}\\s*`), "").trim();
}

function depthAwareKnowledgeContent(content: string, title: string, depth: AnswerDepth) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (depth === "advanced") {
    const excerpt = normalized.length <= 820 ? normalized : `${normalized.slice(0, 820).replace(/[，,；;：:\s]+$/, "")}。`;
    return [
      excerpt,
      "",
      "进阶看法：先分清这是产区口径、树种线索还是市场命名，再结合香气表现和材料形态判断。"
    ].join("\n");
  }

  if (depth === "decision") {
    const excerpt = normalized.length <= 460 ? normalized : `${normalized.slice(0, 460).replace(/[，,；;：:\s]+$/, "")}。`;
    return [
      excerpt,
      "",
      "购买决策可以按三步看：",
      "1. 先确认用途：日常闻香、送礼、空间扩香还是收藏。",
      "2. 再比较体验：甜、凉、木质、药感、烟感和留香是否符合预期。",
      "3. 最后核对证据：来源说明、复闻记录、检测材料和价格是否互相匹配。"
    ].join("\n");
  }

  const excerpt = normalized.length <= 360 ? normalized : `${normalized.slice(0, 360).replace(/[，,；;：:\s]+$/, "")}。`;
  return [
    excerpt,
    "",
    `简单说，${title}主要是帮助你先建立方向感，不要一上来就被市场名词带着走。`
  ].join("\n");
}

function buildFallbackText(module: AssistantModule, message: string, recommendations: Recommendation[]) {
  if (module === "encyclopedia") {
    return buildKnowledgeFallbackText(message, []);
  }

  if (module === "mentor") {
    return `我会先给一个低风险闻香方案。围绕“${message}”，建议从清甜、木质或轻柔扩散的单品开始，用电熏低温慢慢试闻，再根据是否喜欢凉意、奶韵、药感或花蜜感继续细分。涉及产区、等级或高价材料时，需要结合实物复闻、来源记录和检测资料判断。`;
  }

  if (recommendations.length === 0) {
    return `我还没有足够的商品候选来做精准推荐。你可以先补充预算、用途、喜欢甜韵还是凉韵，以及想要线香、香粉、手串还是香材；我会按风险更低的顺序给你建议。`;
  }

  const lines = recommendations
    .map((item, index) => {
      const beginnerNote = item.beginnerFriendly ? "新手可以少量试香。" : "不建议新手直接重仓。";
      return `${index + 1}. ${item.product.name}：${item.why} 适合 ${item.suitableFor}。风险点是 ${item.risk}。${beginnerNote}${item.upgradeAdvice}`;
    })
    .join("\n");

  return `我不建议为了预算压力硬买贵货。按“${message}”来看，可以这样判断：\n${lines}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}
