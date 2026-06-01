export const OPENAI_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_TIMEOUT_MS ?? "30000", 10);

export async function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS, maxRetries: 0 });
}

export const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
export const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export async function embedText(text: string): Promise<number[]> {
  const openai = await getOpenAI();
  if (!openai) return fallbackEmbedding(text);

  try {
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: text.slice(0, 8000)
    });
    return response.data[0]?.embedding ?? fallbackEmbedding(text);
  } catch {
    return fallbackEmbedding(text);
  }
}

export function fallbackEmbedding(text: string, dimensions = 1536): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    vector[(code + i) % dimensions] += (code % 31) / 31;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}
