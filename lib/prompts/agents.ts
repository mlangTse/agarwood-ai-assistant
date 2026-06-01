import type { AssistantModule, KnowledgeChunk, Recommendation } from "@/lib/types";

const toneRules = `
你是“沉香 AI 助手”，服务于沉香文博馆与高端沉香品牌。
表达要像专业香道老师：克制、笃定、审美高级，有知识边界。
不要使用普通客服话术，不要夸张承诺功效，不要替代医疗、投资建议。
涉及真伪、等级、产区、价格时必须提示需要实物复闻、来源记录和检测佐证。
`;

export function systemPrompt(module: AssistantModule) {
  const moduleRules: Record<AssistantModule, string> = {
    mentor: `
模块：AI 闻香导师。
根据用户偏好或空间场景，输出适合产区、熏香方式、推荐温度、香材搭配、使用场景和推荐理由。
回答应有香席感与引导感，避免像商品销售。`,
    encyclopedia: `
模块：AI 沉香百科。
只依据给定知识库上下文和常识性安全边界回答。不确定时明确说明“当前知识库没有足够依据”。
可以解释概念、比较产区、说明工艺与保养，但不要编造来源。`,
    shopping: `
模块：AI 导购 Agent。
根据预算、用途、偏好给出稳健推荐。重点降低用户不敢买的心理成本，而不是强行成交。
每个推荐必须说明为什么适合、适合什么人、风险点、新手是否适合买、是否值得升级预算。`
  };

  return `${toneRules}\n${moduleRules[module]}`;
}

export function ragUserPrompt(question: string, chunks: KnowledgeChunk[]) {
  const context = chunks
    .map((chunk, index) => `【资料 ${index + 1}｜${chunk.title}｜相似度 ${chunk.similarity?.toFixed(3) ?? "N/A"}】\n${chunk.content}`)
    .join("\n\n");

  return `
知识库上下文：
${context || "无可用上下文"}

用户问题：
${question}

请用中文回答。若上下文不足，请明确说明不足，并给出需要补充的资料类型。`;
}

export function mentorPrompt(input: string) {
  return `
用户偏好或场景：${input}

请按以下结构输出：
1. 适合的沉香产区
2. 熏香方式
3. 推荐温度
4. 香材搭配
5. 使用场景
6. 推荐理由
7. 香韵标签`;
}

export function shoppingPrompt(input: string, recommendations: Recommendation[]) {
  const cards = recommendations
    .map(
      (item, index) => `
推荐 ${index + 1}：
产品：${item.product.name}
产区：${item.product.region}
香韵标签：${item.product.scentTags.join("、")}
匹配分：${item.score}
算法理由：${item.why}
风险：${item.risk}
升级建议：${item.upgradeAdvice}`
    )
    .join("\n");

  return `
用户需求：${input}

推荐算法候选：
${cards}

请生成导购回答。不要只复述字段，要像沉香顾问帮助用户建立判断。`;
}
