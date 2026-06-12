import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const wikiRoot = path.join(root, "knowledge", "wiki");
const ragPath = path.join(root, "lib", "rag.ts");
const optionPrefix = ["用户通过选项", "表达了以下偏好："].join("");

const fixedTopicCases = [
  {
    input: `${optionPrefix}主题：产区对比`,
    topic: "产区对比",
    wikiPath: "concepts/产区对比.md"
  },
  {
    input: `${optionPrefix}主题：香韵解释`,
    topic: "香韵解释",
    wikiPath: "concepts/香韵解释.md"
  },
  {
    input: `${optionPrefix}主题：真假鉴别`,
    topic: "真假鉴别",
    wikiPath: "concepts/真假鉴别.md"
  },
  {
    input: `${optionPrefix}主题：价格等级`,
    topic: "价格等级",
    wikiPath: "concepts/价格等级.md"
  }
];

function extractTitle(content) {
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  return withoutFrontmatter.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ragSource = await readFile(ragPath, "utf8");
assert(ragSource.includes("FIXED_TOPIC_PAGES"), "RAG 缺少固定主题映射 FIXED_TOPIC_PAGES");
assert(ragSource.includes("readFixedTopicChunk"), "RAG 缺少固定主题 concept 页读取逻辑");
assert(ragSource.includes("exact_topic"), "PostgreSQL RAG 缺少 exact title/path 优先 CTE");

for (const testCase of fixedTopicCases) {
  const fullPath = path.join(wikiRoot, testCase.wikiPath);
  const content = await readFile(fullPath, "utf8");
  const title = extractTitle(content);

  assert(ragSource.includes(`"${testCase.topic}": "${testCase.wikiPath}"`), `RAG 固定映射缺少 ${testCase.topic} -> ${testCase.wikiPath}`);
  assert(title === testCase.topic, `固定主题路由失败：${testCase.input} 应命中 ${testCase.topic}，实际是 ${title ?? "无标题"}`);

  if (!/树种列表|物种列表/.test(testCase.input)) {
    assert(!/microcarpa|rostrata/i.test(content), `${testCase.topic} 主题页含有物种列表碎片 microcarpa/rostrata`);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: fixedTopicCases.length,
      routes: fixedTopicCases.map((item) => ({ topic: item.topic, wikiPath: item.wikiPath }))
    },
    null,
    2
  )
);
