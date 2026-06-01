import type { Product } from "@/lib/types";

export const sampleProducts: Product[] = [
  {
    id: "p-hui-an-sweet-wood",
    name: "惠安系蜜韵沉香小料",
    type: "wood",
    region: "越南惠安系",
    priceCents: 320000,
    budgetLevel: "3000",
    description: "甜润、清雅，适合低温细闻与茶席空间。",
    riskNotes: ["油脂表现较细腻，新手需避免用高温猛熏", "同产区价差大，需看香气稳定性"],
    suitableFor: ["茶室", "静坐", "偏好甜香的入门进阶用户"],
    aromaScores: {
      sweetness: 86,
      coolness: 42,
      creaminess: 58,
      medicinal: 34,
      woody: 62,
      penetration: 54,
      longevity: 60,
      beginnerFriendly: 82,
      collectionValue: 48
    },
    scentTags: ["甜韵", "花蜜", "清雅", "茶室"],
    inventoryStatus: "limited"
  },
  {
    id: "p-xingzhou-cool-powder",
    name: "星洲凉韵沉香粉",
    type: "powder",
    region: "星洲系加里曼丹",
    priceCents: 68000,
    budgetLevel: "500",
    description: "凉意明显，木质感清晰，适合电熏体验产区差异。",
    riskNotes: ["粉类不适合长期密封潮湿环境", "低价产品需确认无香精添加"],
    suitableFor: ["办公室", "商务空间", "想低门槛试香的新手"],
    aromaScores: {
      sweetness: 38,
      coolness: 82,
      creaminess: 24,
      medicinal: 52,
      woody: 78,
      penetration: 72,
      longevity: 66,
      beginnerFriendly: 88,
      collectionValue: 28
    },
    scentTags: ["凉韵", "木质", "清醒", "电熏"],
    inventoryStatus: "in_stock"
  },
  {
    id: "p-qinan-collector",
    name: "奇楠级熟结藏品",
    type: "investment",
    region: "惠安系高阶藏品",
    priceCents: 18800000,
    budgetLevel: "collector",
    description: "层次变化强，乳韵、凉韵与穿透力兼具，适合资深收藏。",
    riskNotes: ["鉴定门槛高，不建议首次购买即重仓", "需完整来源、检测和长期复闻记录"],
    suitableFor: ["资深藏家", "文博馆展陈", "品牌镇店级藏品"],
    aromaScores: {
      sweetness: 72,
      coolness: 88,
      creaminess: 86,
      medicinal: 70,
      woody: 56,
      penetration: 94,
      longevity: 92,
      beginnerFriendly: 32,
      collectionValue: 96
    },
    scentTags: ["奇楠", "乳韵", "凉韵", "收藏级"],
    inventoryStatus: "limited"
  },
  {
    id: "p-bracelet-daily",
    name: "沉水级沉香手串 16mm",
    type: "bracelet",
    region: "达拉干",
    priceCents: 2200000,
    budgetLevel: "20000",
    description: "佩戴稳定，甜凉平衡，适合日常雅玩与礼赠。",
    riskNotes: ["手串不宜用汗手频繁盘玩", "需说明重量、密度和自然纹理差异"],
    suitableFor: ["商务礼赠", "日常佩戴", "已有基础认知的用户"],
    aromaScores: {
      sweetness: 68,
      coolness: 63,
      creaminess: 48,
      medicinal: 44,
      woody: 74,
      penetration: 58,
      longevity: 78,
      beginnerFriendly: 62,
      collectionValue: 72
    },
    scentTags: ["手串", "甜凉", "礼赠", "沉水级"],
    inventoryStatus: "in_stock"
  },
  {
    id: "p-sleep-incense",
    name: "寝香线香 甜木配方",
    type: "incense",
    region: "惠安与海南复配",
    priceCents: 52000,
    budgetLevel: "500",
    description: "低烟、甜木调，适合睡前半小时营造安定空间。",
    riskNotes: ["睡眠场景注意通风，燃尽后再入睡", "对烟敏感者可改用电熏"],
    suitableFor: ["助眠", "卧室", "初次接触沉香香品的人"],
    aromaScores: {
      sweetness: 74,
      coolness: 28,
      creaminess: 44,
      medicinal: 22,
      woody: 58,
      penetration: 38,
      longevity: 52,
      beginnerFriendly: 90,
      collectionValue: 18
    },
    scentTags: ["助眠", "甜木", "线香", "低烟"],
    inventoryStatus: "in_stock"
  }
];

export const regionNotes = [
  {
    name: "惠安系",
    character: "甜润、花蜜、清透，常适合低温细品。",
    scenes: ["茶室", "静坐", "夜读"]
  },
  {
    name: "星洲系",
    character: "木质、凉感、穿透力较强，空间表现更直接。",
    scenes: ["商务空间", "办公室", "展厅"]
  },
  {
    name: "海南",
    character: "雅正、温润、文化属性强，适合文博叙事。",
    scenes: ["文博馆", "雅集", "礼赠"]
  }
];
