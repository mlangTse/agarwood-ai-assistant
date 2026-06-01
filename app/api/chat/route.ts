import { NextRequest } from "next/server";
import { z } from "zod";
import { readCompatibleModelStream, streamChatCompletion } from "@/lib/model-api";
import { mentorPrompt, ragUserPrompt, shoppingPrompt, systemPrompt } from "@/lib/prompts/agents";
import { recommendProducts, inferUserPreference } from "@/lib/recommendation";
import { listProducts } from "@/lib/products";
import { retrieveKnowledge } from "@/lib/rag";
import { sampleProducts } from "@/lib/sample-data";
import type { AssistantModule, Product, Recommendation } from "@/lib/types";

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
    const chunks = await retrieveKnowledge(message);
    return {
      prompt: ragUserPrompt(message, chunks),
      recommendations: [] as Recommendation[],
      fallbackText: buildKnowledgeFallbackText(message, chunks),
      meta: {
        scentTags: ["知识库", "RAG", "谨慎回答"],
        sources: chunks.map((chunk) => ({ title: chunk.title, similarity: chunk.similarity }))
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
        scentTags: ["本地兜底", "知识库暂不可用", "谨慎回答"],
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
      controller.enqueue(
        encoder.encode(`event: meta\ndata: ${JSON.stringify(context.meta)}\n\n`)
      );
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

function buildKnowledgeFallbackText(message: string, chunks: { title: string; content: string }[]) {
  if (chunks.length === 0) {
    return `我没有在当前知识库里找到足够贴合“${message}”的资料。请先在后台上传相关 Markdown、TXT 或 PDF，上传后我会按知识库片段来回答，并在右侧显示引用来源。`;
  }

  const notes = chunks
    .slice(0, 3)
    .map((chunk, index) => `${index + 1}. ${chunk.title}：${chunk.content.replace(/\s+/g, " ").slice(0, 180)}`)
    .join("\n");

  return `我按已上传知识库回答“${message}”：\n${notes}\n\n以上是知识库中最相关的片段整理。若用于鉴定或购买，还需要结合实物复闻、来源记录和检测资料。`;
}

function buildFallbackText(module: AssistantModule, message: string, recommendations: Recommendation[]) {
  if (module === "encyclopedia") {
    return `我会先按知识库口径回答。“${message}”这个问题需要结合产区、结香状态与实物香气判断。当前本地演示知识库可以说明基础概念，但若要做购买或鉴定决策，还需要补充来源记录、检测资料和复闻样本。`;
  }

  if (module === "mentor") {
    return `以你的描述“${message}”来看，香席不宜一开始就追求强烈。可先选惠安系或甜凉平衡的星洲系，用电熏从 80-110 摄氏度缓慢升温。若用于茶室，取甜韵、木质感清楚的小料；若用于商务空间，可稍取凉感和穿透力。香材搭配宜少，先单品复闻，再考虑与海南甜木或低烟线香做空间铺底。`;
  }

  const lines = recommendations
    .map(
      (item, index) =>
        `${index + 1}. ${item.product.name}：${item.why} 适合 ${item.suitableFor}。风险点是 ${item.risk}。${item.beginnerFriendly ? "新手可以买，但要小量试香。" : "不建议新手直接重仓。"}${item.upgradeAdvice}`
    )
    .join("\n");
  return `我不会建议你为了预算而硬买贵货。按“${message}”来看，可以先这样判断：\n${lines}`;
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
