import { clamp } from "@/lib/utils";
import { sampleProducts } from "@/lib/sample-data";
import type { AromaScoreKey, AromaScores, BudgetLevel, Product, ProductType, Recommendation, UserPreference } from "@/lib/types";

const budgetCeiling: Record<BudgetLevel, number> = {
  "500": 80000,
  "3000": 500000,
  "20000": 3000000,
  collector: Number.POSITIVE_INFINITY
};

const sceneProfiles: Record<string, Partial<AromaScores>> = {
  打坐: { sweetness: 62, coolness: 48, woody: 58, penetration: 44, longevity: 62 },
  静坐: { sweetness: 62, coolness: 48, woody: 58, penetration: 44, longevity: 62 },
  助眠: { sweetness: 72, coolness: 25, creaminess: 42, penetration: 30, beginnerFriendly: 85 },
  茶室: { sweetness: 78, creaminess: 54, woody: 60, penetration: 48, beginnerFriendly: 72 },
  书房: { sweetness: 68, coolness: 46, woody: 68, penetration: 42, beginnerFriendly: 76 },
  商务空间: { coolness: 70, woody: 76, penetration: 76, longevity: 68 },
  送礼: { sweetness: 70, woody: 62, beginnerFriendly: 78, collectionValue: 54 },
  收藏: { collectionValue: 92, longevity: 82, penetration: 82, beginnerFriendly: 35 }
};

const tagProfiles: Record<string, Partial<AromaScores>> = {
  甜香: { sweetness: 88, creaminess: 55 },
  清甜: { sweetness: 86, coolness: 45, beginnerFriendly: 76 },
  凉意: { coolness: 88, penetration: 72 },
  奶韵: { creaminess: 88, sweetness: 66 },
  药感: { medicinal: 86, coolness: 62 },
  木质: { woody: 88 },
  花蜜: { sweetness: 84, creaminess: 48 },
  清雅: { sweetness: 62, coolness: 60, woody: 58, beginnerFriendly: 82 },
  新手: { beginnerFriendly: 92, collectionValue: 30 }
};

const productTypeKeywords: Record<ProductType, string[]> = {
  wood: ["香材", "原材", "小料", "随形"],
  bracelet: ["手串", "珠串"],
  powder: ["香粉", "粉"],
  incense: ["线香", "卧香", "熏香"],
  object: ["摆件", "雕件", "雅器"],
  investment: ["收藏", "投资", "藏品"]
};

const scoreKeys: AromaScoreKey[] = [
  "sweetness",
  "coolness",
  "creaminess",
  "medicinal",
  "woody",
  "penetration",
  "longevity",
  "beginnerFriendly",
  "collectionValue"
];

export function inferUserPreference(input: string): UserPreference {
  const tags = Object.keys(tagProfiles).filter((tag) => input.includes(tag) || input.includes(tag.replace("香", "")));
  const scenes = Object.keys(sceneProfiles).filter((scene) => input.includes(scene));
  const budget = inferBudget(input);
  const productTypes = inferProductTypes(input);
  const desiredScores: Partial<AromaScores> = {};

  for (const scene of scenes) mergeScores(desiredScores, sceneProfiles[scene]);
  for (const tag of tags) mergeScores(desiredScores, tagProfiles[tag]);
  if (Object.keys(desiredScores).length === 0) {
    mergeScores(desiredScores, { sweetness: 62, woody: 62, beginnerFriendly: 70 });
  }

  return { budget, scenes, tags, desiredScores, productTypes };
}

export function recommendProducts(preference: UserPreference, products: Product[] = sampleProducts, limit = 3): Recommendation[] {
  return products
    .filter((product) => {
      if (!preference.budget) return true;
      if (preference.budget === "collector") return true;
      return product.priceCents <= budgetCeiling[preference.budget] * 1.25;
    })
    .map((product) => {
      const score = calculateAromaMatch(product.aromaScores, preference.desiredScores);
      const sceneBoost = product.suitableFor.some((item) => preference.scenes.some((scene) => item.includes(scene))) ? 8 : 0;
      const tagBoost = product.scentTags.some((tag) => preference.tags.some((userTag) => tag.includes(userTag) || userTag.includes(tag))) ? 6 : 0;
      const typeBoost = preference.productTypes?.includes(product.type) ? 12 : 0;
      const total = clamp(score + sceneBoost + tagBoost + typeBoost);
      return buildRecommendation(product, total, preference);
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function calculateAromaMatch(product: AromaScores, desired: Partial<AromaScores>) {
  const entries = scoreKeys.filter((key) => typeof desired[key] === "number");
  if (entries.length === 0) return 60;

  const distance = entries.reduce((sum, key) => sum + Math.abs(product[key] - Number(desired[key])), 0) / entries.length;
  return clamp(100 - distance);
}

function buildRecommendation(product: Product, score: number, preference: UserPreference): Recommendation {
  const highBeginner = product.aromaScores.beginnerFriendly >= 70;
  const scene = preference.scenes[0] ?? product.suitableFor[0] ?? "日常品香";
  const upgradeAdvice =
    product.budgetLevel === "500"
      ? "若已经能分辨甜、凉、木质三类香气，可升级到 3000 元级小料做产区对比。"
      : product.budgetLevel === "collector"
        ? "无需盲目升级预算，优先补齐来源、检测与长期复闻记录。"
        : "值得在明确偏好后小幅升级预算，但不建议为了“沉水”二字直接加价。";

  return {
    product,
    score,
    why: `${product.region} 的气味轮廓与${scene}场景较贴合，香气重点在 ${product.scentTags.slice(0, 3).join("、")}。`,
    suitableFor: product.suitableFor.join("、"),
    risk: product.riskNotes.join("；"),
    beginnerFriendly: highBeginner,
    upgradeAdvice
  };
}

function mergeScores(target: Partial<AromaScores>, source: Partial<AromaScores>) {
  for (const [key, value] of Object.entries(source) as [AromaScoreKey, number][]) {
    target[key] = typeof target[key] === "number" ? Math.round((Number(target[key]) + value) / 2) : value;
  }
}

function inferBudget(input: string): BudgetLevel | undefined {
  if (/收藏级|投资|高货|顶级/.test(input)) return "collector";
  if (/2万|20000|两万|二万|1万|10000|一万/.test(input)) return "20000";
  if (/3000|三千|3千|5000|五千|5千|千元/.test(input)) return "3000";
  if (/500|五百|入门|试香|小预算|1000|一千|千以内/.test(input)) return "500";
  return undefined;
}

function inferProductTypes(input: string): ProductType[] {
  return (Object.entries(productTypeKeywords) as [ProductType, string[]][])
    .filter(([, keywords]) => keywords.some((keyword) => input.includes(keyword)))
    .map(([type]) => type);
}
