export type AssistantModule = "mentor" | "encyclopedia" | "shopping";

export type AromaScoreKey =
  | "sweetness"
  | "coolness"
  | "creaminess"
  | "medicinal"
  | "woody"
  | "penetration"
  | "longevity"
  | "beginnerFriendly"
  | "collectionValue";

export type AromaScores = Record<AromaScoreKey, number>;

export type BudgetLevel = "500" | "3000" | "20000" | "collector";

export type ProductType = "wood" | "bracelet" | "powder" | "incense" | "object" | "investment";

export type Product = {
  id: string;
  name: string;
  type: ProductType;
  region: string;
  priceCents: number;
  budgetLevel: BudgetLevel;
  description: string;
  riskNotes: string[];
  suitableFor: string[];
  aromaScores: AromaScores;
  scentTags: string[];
  inventoryStatus: "in_stock" | "limited" | "archived";
};

export type Region = {
  id: string;
  name: string;
  country: string;
  aromaCharacter: string;
  typicalScenes: string[];
  riskNotes: string[];
  character?: string;
  scenes?: string[];
};

export type Recommendation = {
  product: Product;
  score: number;
  why: string;
  suitableFor: string;
  risk: string;
  beginnerFriendly: boolean;
  upgradeAdvice: string;
};

export type MentorResult = {
  regions: string[];
  method: string;
  temperature: string;
  pairings: string[];
  scenes: string[];
  reason: string;
  scentTags: string[];
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type KnowledgeChunk = {
  id?: string;
  documentId?: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  similarity?: number;
};

export type UserPreference = {
  budget?: BudgetLevel;
  scenes: string[];
  tags: string[];
  desiredScores: Partial<AromaScores>;
  productTypes?: ProductType[];
};
