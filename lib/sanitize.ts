const UNKNOWN_TEXT_PATTERNS = [
  /unknown/i,
  /^n\/?a$/i,
  /^\?+$/,
  /^[\s\-_/]*$/,
  /^\u672a\u77e5$/,
  /^\u672a\u63d0\u4f9b$/,
  /^\u672a\u586b$/,
  /^\u672a\u586b\u5199$/,
  /^\u672a\u6807\u6ce8(?:\u4ea7\u533a)?$/,
  /^\u5f85\u8865\u5145$/,
  /^\u5f85\u8be2\u4ef7$/,
  /^\u6682\u65e0$/,
  /^\u65e0$/
];

const UNKNOWN_VALUE_PATTERN =
  /^(?:unknown|n\/?a|\?+|\u672a\u77e5|\u672a\u63d0\u4f9b|\u672a\u586b(?:\u5199)?|\u672a\u6807\u6ce8(?:\u4ea7\u533a)?|\u5f85\u8865\u5145|\u5f85\u8be2\u4ef7|\u6682\u65e0|\u65e0)$/i;

const FIELD_WITH_UNKNOWN_VALUE_PATTERN =
  /^(\s*[-*]?\s*[^:\uff1a]+[:\uff1a]\s*)(?:unknown|n\/?a|\?+|\u672a\u77e5|\u672a\u63d0\u4f9b|\u672a\u586b(?:\u5199)?|\u672a\u6807\u6ce8(?:\u4ea7\u533a)?|\u5f85\u8865\u5145|\u5f85\u8be2\u4ef7|\u6682\u65e0|\u65e0)\s*$/i;

export function isUnknownValue(value: unknown) {
  if (value === undefined || value === null) return true;
  const text = String(value).trim();
  return UNKNOWN_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

export function sanitizeTextValue(value: unknown) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (isUnknownValue(text)) return "";
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isUnknownValue(line))
    .join("\n");
}

export function sanitizeStringList(values: unknown[]) {
  return values.map((value) => sanitizeTextValue(value)).filter(Boolean);
}

export function sanitizeKnowledgeText(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (isUnknownValue(trimmed)) return false;
      if (FIELD_WITH_UNKNOWN_VALUE_PATTERN.test(trimmed)) return false;
      return !UNKNOWN_VALUE_PATTERN.test(trimmed);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
