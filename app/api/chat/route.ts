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
    const chunks = await retrieveKnowledge(message, 8);
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

function buildKnowledgeFallbackText(message: string, chunks: { title: string; content: string }[]) {
  if (chunks.length === 0) {
    return `我没有在当前知识库里找到足够贴合“${message}”的资料。建议先补充产区来源、树种、结香方式、检测或合法来源证明等材料；补充后我会按知识库片段回答，并在侧栏展示引用来源。`;
  }

  const cleanedChunks = uniqueKnowledgeChunks(chunks)
    .map((chunk) => ({
      title: cleanKnowledgeTitle(chunk.title),
      content: cleanKnowledgeContent(chunk.content)
    }))
    .filter((chunk) => chunk.content.length >= 20)
    .slice(0, 4);

  if (cleanedChunks.length === 0) {
    return `我在知识库里找到了相关页面，但片段内容不足以组成可靠回答。建议补充更完整的原文，或换一个更具体的问题，例如产区、树种、香韵、结香方式、保护状态或购买风险。`;
  }

  const summary = cleanedChunks
    .map((chunk) => firstSentence(chunk.content))
    .filter(Boolean)
    .slice(0, 3);
  const sourceLine = cleanedChunks.map((chunk) => chunk.title).join("、");

  return [
    `按当前知识库，“${message}”可以先这样理解：${summary.join("；")}。`,
    "",
    `这不是鉴定结论，而是基于已上传资料的整理。真正用于购买、鉴定或对外宣传时，还要结合实物复闻、来源记录、检测资料和合法来源证明。`,
    "",
    `参考页面：${sourceLine}。`
  ].join("\n");
}

function uniqueKnowledgeChunks(chunks: { title: string; content: string }[]) {
  const seen = new Set<string>();
  const unique: { title: string; content: string }[] = [];
  for (const chunk of chunks) {
    const key = `${cleanKnowledgeTitle(chunk.title)}\n${cleanKnowledgeContent(chunk.content).slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
  }
  return unique;
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

function firstSentence(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  const sentence = normalized.match(/^.{24,220}?[。！？.!?；;]/)?.[0] ?? normalized.slice(0, 160);
  return sentence.replace(/[，,;；:：\s]+$/, "");
}

function buildFallbackText(module: AssistantModule, message: string, recommendations: Recommendation[]) {
  if (module === "encyclopedia") {
    return buildKnowledgeFallbackText(message, []);
  }

  if (module === "mentor") {
    return `从你的描述“${message}”来看，建议先从低风险的单品闻香开始，不急着追求强烈或高价。可以用电熏从 80-110 摄氏度缓慢升温，观察甜韵、凉感、木质感和烟感的变化。如果是茶席或日常空间，先选清甜、温润、烟感低的香材；如果是展厅或商务空间，再考虑扩散感更强的口径。`;
  }

  if (recommendations.length === 0) {
    return `我还没有足够的商品候选来做精准推荐。你可以先告诉我预算、用途、喜欢甜韵还是凉韵、想要线香/香粉/手串/香材哪一类，我会按风险更低的顺序给你建议。`;
  }

  const lines = recommendations
    .map(
      (item, index) =>
        `${index + 1}. ${item.product.name}：${item.why} 适合 ${item.suitableFor}。风险点是 ${item.risk}。${
          item.beginnerFriendly ? "新手可以少量试香。" : "不建议新手直接重仓。"
        }${item.upgradeAdvice}`
    )
    .join("\n");

  return `我不会建议你为了预算压力硬买贵货。按“${message}”来看，可以这样判断：\n${lines}`;
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
