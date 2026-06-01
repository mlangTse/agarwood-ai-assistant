export const MODEL_API_TIMEOUT_MS = Number.parseInt(process.env.MODEL_API_TIMEOUT_MS ?? "30000", 10);
export const chatModel = process.env.MODEL_CHAT_MODEL ?? "deepseek-chat";
export const embeddingModel = process.env.MODEL_EMBEDDING_MODEL ?? "text-embedding-v1";
export const embeddingDimensions = Number.parseInt(process.env.MODEL_EMBEDDING_DIMENSIONS ?? "1536", 10);

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatStreamInput = {
  messages: ChatMessage[];
  temperature?: number;
  signal?: AbortSignal;
};

export function isModelApiConfigured() {
  return Boolean(process.env.MODEL_API_KEY && process.env.MODEL_API_BASE_URL);
}

export async function streamChatCompletion(input: ChatStreamInput) {
  if (!isModelApiConfigured()) return null;

  const response = await fetch(`${normalizedBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: modelHeaders(),
    body: JSON.stringify({
      model: chatModel,
      stream: true,
      temperature: input.temperature ?? 0.6,
      messages: input.messages
    }),
    signal: input.signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`模型接口请求失败：HTTP ${response.status}`);
  }

  return response.body;
}

export async function embedText(text: string): Promise<number[]> {
  if (!isModelApiConfigured() || process.env.MODEL_EMBEDDING_DISABLED === "true") {
    return fallbackEmbedding(text, embeddingDimensions);
  }

  try {
    const response = await fetch(`${normalizedBaseUrl()}/embeddings`, {
      method: "POST",
      headers: modelHeaders(),
      body: JSON.stringify({
        model: embeddingModel,
        input: text
      }),
      signal: AbortSignal.timeout(MODEL_API_TIMEOUT_MS)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = (await response.json()) as { data?: { embedding?: number[] }[] };
    const embedding = json.data?.[0]?.embedding;
    return Array.isArray(embedding) && embedding.length > 0 ? embedding : fallbackEmbedding(text, embeddingDimensions);
  } catch (error) {
    console.warn("Embedding API unavailable, using deterministic local embedding:", error);
    return fallbackEmbedding(text, embeddingDimensions);
  }
}

export function fallbackEmbedding(text: string, dimensions = embeddingDimensions): number[] {
  const vector = new Array(dimensions).fill(0);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const slot = (code + index * 31) % dimensions;
    vector[slot] += ((code % 97) + 1) / 97;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export async function* readCompatibleModelStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
          const token = json.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // Ignore provider keepalive or non-JSON stream fragments.
        }
      }
    }
  }
}

function normalizedBaseUrl() {
  return String(process.env.MODEL_API_BASE_URL).replace(/\/+$/, "");
}

function modelHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MODEL_API_KEY}`
  };
}
