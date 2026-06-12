import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rawRoot = path.join(root, "knowledge", "raw");
const wikiRoot = path.join(root, "knowledge", "wiki");
const today = new Date().toISOString().slice(0, 10);

const sourceSummaryByFile = {
  "Appendices  CITES.md": {
    title: "CITES 附录",
    summary: "CITES 附录解释国际濒危物种贸易管理框架，是判断沉香属、拟沉香属材料跨境合规的重要背景。",
    links: ["CITES", "合规表达", "沉香贸易"]
  },
  "Aquilaria.md": {
    title: "Aquilaria 沉香属",
    summary: "沉香属是沉香主要基原类群之一，与拟沉香属共同构成香料级沉香的重要植物来源。",
    links: ["Aquilaria", "沉香属", "Gyrinops", "沉香树种"]
  },
  "Agarwood.md": {
    title: "Agarwood 沉香总论",
    summary: "英文资料介绍 agarwood/oud 的形成、用途、香气、价格、贸易、CITES 和文化背景，适合补充香韵、价格等级、工艺和合规边界。",
    links: ["沉香", "香韵解释", "价格等级", "沉香贸易", "CITES"]
  },
  "Aquilaria crassna.md": {
    title: "Aquilaria crassna",
    summary: "A. crassna 是东南亚沉香来源树种之一，资料强调其濒危状态、树脂心材用途与人工诱导/感染形成沉香的背景。",
    links: ["Aquilaria crassna", "沉香树种", "结香"]
  },
  "Aquilaria malaccensis.md": {
    title: "Aquilaria malaccensis",
    summary: "A. malaccensis 是沉香贸易中极重要的树种，资料涉及沉香用途、威胁、保护和过度采伐问题。",
    links: ["Aquilaria malaccensis", "沉香树种", "濒危保护", "沉香贸易"]
  },
  "Aquilaria sinensis.md": {
    title: "Aquilaria sinensis 土沉香/白木香",
    summary: "A. sinensis 是中国语境中的土沉香/白木香，资料涉及香港、药用传统、树脂采集、保护与 CITES 附录 II 管理。",
    links: ["Aquilaria sinensis", "土沉香", "香港沉香树", "CITES"]
  },
  "Checklist of CITES species.md": {
    title: "CITES 物种清单",
    summary: "CITES 物种清单用于核对受管制物种；当前资料较宽泛，使用时应结合 Aquilaria/Gyrinops 专门条目检索。",
    links: ["CITES", "合规表达"]
  },
  "Computational models and neural mechanisms of causal inference in multisensory integration.md": {
    title: "多感觉整合中的因果推断",
    summary: "这是一篇多感觉整合与因果推断论文，和沉香物种/贸易关系较弱；可作为闻香体验研究的外围参考，不作为沉香事实主源。",
    links: ["闻香体验", "资料边界"]
  },
  "Gyrinops.md": {
    title: "Gyrinops 拟沉香属",
    summary: "拟沉香属与沉香属同为沉香重要来源类群，资料涉及沉香生产和物种列表。",
    links: ["Gyrinops", "沉香树种", "Aquilaria"]
  },
  "History of Use and Trade of Agarwood - Ethnobotany and Economic Botany.md": {
    title: "沉香使用与贸易史",
    summary: "资料从民族植物学和经济植物学角度讨论 agarwood 的使用、贸易、历史流通和经济价值。",
    links: ["沉香贸易", "沉香使用史", "合规表达"]
  },
  "Kew Science.md": {
    title: "Kew Science: Aquilaria",
    summary: "Kew POWO 的 Aquilaria 检索结果和分类资料，适合核对沉香属物种、异名和植物分类口径。",
    links: ["Kew POWO", "Aquilaria", "沉香树种"]
  },
  "Kew Science 1.md": {
    title: "Kew Science: Gyrinops",
    summary: "Kew POWO 的 Gyrinops 检索结果，同时出现 Aquilaria 对照信息，适合核对拟沉香属物种和分类口径。",
    links: ["Kew POWO", "Gyrinops", "Aquilaria"]
  },
  "Kōdō.md": {
    title: "Kōdō 香道",
    summary: "香道资料适合补充闻香场景、隔火体验、香席文化、香材等级和审美表达，但不能转写成疗效承诺。",
    links: ["闻香场景", "熏闻方式", "沉香使用史", "合规表达"]
  },
  "The IUCN Red List of Threatened Species.md": {
    title: "IUCN 红色名录检索",
    summary: "IUCN 红色名录检索结果用于核对沉香相关物种保护状态，但具体结论需回到对应物种页面。",
    links: ["IUCN", "濒危保护", "沉香树种"]
  },
  "Trees That Gave Hong Kong Its Name Are Nearing Extinction.md": {
    title: "香港沉香树濒危报道",
    summary: "报道指出给香港带来名称联想的沉香树正接近灭绝，强调非法砍伐、保护压力和本地生态文化价值。",
    links: ["香港沉香树", "Aquilaria sinensis", "濒危保护"]
  },
  "土沉香 - 维基百科，自由的百科全书.md": {
    title: "土沉香",
    summary: "中文资料介绍土沉香的异名、特征、用途、保护情况和类似品种，是 A. sinensis 中文口径的重要来源。",
    links: ["土沉香", "Aquilaria sinensis", "濒危保护"]
  },
  "电白区 - 维基百科，自由的百科全书.md": {
    title: "电白区",
    summary: "电白区资料用于补充电白/茂名地域背景，可服务电白沉香的地方产区、礼赠和文旅展陈口径；具体沉香产业事实仍需更多地方资料佐证。",
    links: ["产区对比", "闻香场景", "合规表达"]
  },
  "沉香 - 维基百科，自由的百科全书.md": {
    title: "沉香",
    summary: "中文资料介绍沉香种类、结香机理、鉴别、致香成分、香料、药用与投资骗局风险。",
    links: ["沉香", "结香", "鉴别风险", "合规表达"]
  },
  "沉香 - 维基百科，自由的百科全书 1.md": {
    title: "沉香 备份条目",
    summary: "该文件与沉香中文维基资料高度相似，作为备份来源保留；事实整理时优先合并到核心概念页。",
    links: ["沉香", "结香", "资料边界"]
  },
  "沉香属 - 维基百科，自由的百科全书.md": {
    title: "沉香属",
    summary: "中文资料介绍沉香属物种和保育状况，可与 Kew、CITES、IUCN 资料互相校验。",
    links: ["沉香属", "Aquilaria", "沉香树种"]
  },
  "沉香树 - 维基百科，自由的百科全书.md": {
    title: "沉香树",
    summary: "中文资料介绍沉香树用途、类似品种和参考文献，可用于普通用户对树与香材关系的基础解释。",
    links: ["沉香树种", "沉香", "土沉香"]
  }
};

function yamlValue(value) {
  return JSON.stringify(value);
}

function fm(tags, sources = []) {
  const sourceBlock = sources.length > 0 ? `sources:\n${sources.map((source) => `  - ${yamlValue(source)}`).join("\n")}` : "sources: []";
  return `---\ntags:\n${tags.map((tag) => `  - ${yamlValue(tag)}`).join("\n")}\ndate: ${today}\n${sourceBlock}\n---\n\n`;
}

function slugFileName(name) {
  return name
    .replace(/\.md$/i, "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function extractFrontmatterTitle(content) {
  const match = content.match(/^---\n[\s\S]*?\ntitle:\s*["']?(.+?)["']?\s*\n[\s\S]*?\n---\n/);
  return match?.[1]?.trim();
}

function extractFirstHeading(content) {
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const match = withoutFrontmatter.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function excerpt(content, length = 900) {
  return content
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[[^\]]+]\([^)]+\)/g, (match) => match.replace(/^\[|\]\([^)]+\)$/g, ""))
    .replace(/\[\^[^\]]+]:.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, length);
}

function linkList(items) {
  return items.map((item) => `[[${item}]]`).join("、");
}

async function listRawFiles() {
  const entries = await readdir(rawRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

async function writeManagedPage(relativePath, content) {
  const fullPath = path.join(wikiRoot, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf8");
}

function sourcePage(rawFile, content) {
  const known = sourceSummaryByFile[rawFile];
  const title = known?.title ?? extractFrontmatterTitle(content) ?? extractFirstHeading(content) ?? rawFile.replace(/\.md$/i, "");
  const links = known?.links ?? ["资料边界"];
  const summary = known?.summary ?? "该原始资料尚未人工细分摘要，已纳入 RAG，可在后续摄入中继续整理为概念页或实体页。";
  return {
    title,
    wikiName: slugFileName(rawFile),
    summary,
    content:
      fm(["source"], [rawFile]) +
      `# ${title}\n\n${summary}\n\n## 资料边界\n\n- 原始文件：\`${rawFile}\`\n- 若源文件为英文，RAG 和 AI Agent 必须用中文解释、转述和回答。\n- 该页是资料摘要，不替代原文；涉及保护等级、贸易规则、药用或法律问题时，应回到原文和最新官方资料核对。\n\n## 关键关联\n\n${linkList(links)}\n\n## 原文摘录\n\n> ${excerpt(content)}\n`
  };
}

function conceptPages(rawFiles) {
  const allSources = rawFiles;
  return [
    {
      file: "concepts/沉香.md",
      index: "- [[沉香]] - 树脂浸润木材的总入口，回答沉香是什么、如何形成、怎么合规表达。",
      content:
        fm(["concept", "基础"], allSources) +
        `# 沉香\n\n沉香是沉香属（[[Aquilaria]]）和拟沉香属（[[Gyrinops]]）等植物在受伤、感染或外部刺激后形成的含树脂芳香木材。它不是普通木头天然自带香味，也不是整棵树都等于沉香。\n\n## 当前知识库结论\n\n- 沉香的核心是[[结香]]：树体因真菌感染、创伤或人工诱导等压力产生树脂并浸润木质部。\n- 主要树种资料集中在 [[Aquilaria sinensis]]、[[Aquilaria malaccensis]]、[[Aquilaria crassna]] 以及 [[Gyrinops]]。\n- 多份资料强调野外资源承压，沉香相关属种与国际贸易、保护法规和 [[CITES]] 管理密切相关。\n- 面向用户时，英文资料必须转为中文解释；不能直接用英文片段堆砌回答。\n\n## 回答边界\n\n- 不能把“产区名”“沉水”“野生”“奇楠”等市场词直接当成品质证明。\n- 药用资料可以作为传统使用背景，但消费者导购不能承诺医疗疗效。\n- 投资种植、高额回报等说法需谨慎，知识库已有资料提到相关骗局风险。\n\n## 相关\n\n[[结香]]、[[沉香树种]]、[[CITES]]、[[合规表达]]、[[鉴别风险]]\n`
    },
    {
      file: "concepts/结香.md",
      index: "- [[结香]] - 沉香树脂形成机制，包括自然感染、创伤和人工诱导。",
      content:
        fm(["concept", "形成机制"], allSources) +
        `# 结香\n\n结香是沉香价值形成的关键过程：树体受到真菌感染、外部创伤或人工诱导后，产生并积累树脂，形成可用于香料、熏香或药用传统的芳香木材。\n\n## 当前知识库结论\n\n- 英文资料中多次提到 agarwood 是 resinous heartwood，即树脂浸润的心材或木质部。\n- [[Aquilaria crassna]] 资料提到树脂可由寄生真菌感染诱发。\n- [[Aquilaria sinensis]] 资料提到自然真菌感染、外部伤口和可持续采脂方式。\n- 中文资料强调沉香树本身若无结香并无沉香价值。\n\n## 导购解释\n\n可以这样说：沉香不是“木头越老越香”这么简单，而是树在受刺激后形成树脂，树脂沉积的位置、年限、气味和处理方式共同决定表现。\n\n## 相关\n\n[[沉香]]、[[人工种植沉香]]、[[野生沉香]]、[[鉴别风险]]\n`
    },
    {
      file: "concepts/沉香树种.md",
      index: "- [[沉香树种]] - 沉香属、拟沉香属及关键物种的分类口径。",
      content:
        fm(["concept", "植物分类"], allSources) +
        `# 沉香树种\n\n当前 raw 资料的树种主线集中在 [[Aquilaria]]（沉香属）和 [[Gyrinops]]（拟沉香属）。两者都可产生用于香料贸易的 agarwood，但具体物种、分布、保护状态和贸易管制不同。\n\n## 重点实体\n\n- [[Aquilaria sinensis]]：中国语境中的土沉香/白木香，与香港沉香树、传统药用和保护议题关联紧密。\n- [[Aquilaria malaccensis]]：沉香贸易中重要物种，资料强调用途、威胁和保护。\n- [[Aquilaria crassna]]：东南亚物种，资料强调濒危与沉香生产。\n- [[Gyrinops]]：与沉香属共同作为沉香来源类群。\n\n## 使用边界\n\n- 物种名不能直接等同商品品质。\n- Kew/POWO 适合核对分类和异名；IUCN 适合核对保护状态；CITES 适合核对贸易管制。\n\n## 相关\n\n[[Aquilaria]]、[[Gyrinops]]、[[IUCN]]、[[CITES]]\n`
    },
    {
      file: "concepts/产区对比.md",
      index: "- [[产区对比]] - 莞香系、惠安系、星洲系及常见导购边界。",
      content:
        fm(["concept", "产区", "导购"], allSources) +
        `# 产区对比\n\n当前知识库对产区对比已有基础资料，但还不够支撑很细的产地品质结论。回答用户时应把产区当作理解树种、贸易口径和香气风格的线索，而不是鉴定或定级证据。\n\n## 三大常用口径\n\n- 莞香系/中国系：常见口径包括海南、广东、广西、云南、香港土沉香/白木香，基原多关联 [[Aquilaria sinensis]]。适合解释中国本土沉香、白木香、土沉香和保护风险；导购表达可偏清甜、花蜜、温润和日常闻香，但不能说中国系必然等级更高。\n- 惠安系：常见口径包括越南、芽庄、柬埔寨、老挝、泰国等，常与 [[Aquilaria crassna]] 等东南亚树种资料关联。适合讲花果、蜜甜、清雅、层次感和线香/香粉/香材场景；具体产地名需要来源记录和实物复闻佐证。\n- 星洲系：常见口径包括马来西亚、印尼、达拉干、马泥涝、加里曼丹、文莱等，常与 [[Aquilaria malaccensis]]、小果沉香以及 [[Gyrinops]] 等资料关联。导购表达可偏凉感、乳香、木质、穿透力和空间扩散感；常用于手串、香材和空间扩香叙事。\n\n## 导购回答方式\n\n- 先说明用户是在比较风格、用途还是购买风险。\n- 以香韵、产品形态和风险边界解释产区，不把产区名等同品质。\n- 若用户问海南、芽庄、达拉干、马泥涝等具体名称，应提示需要来源记录、实物复闻、检测资料和合法来源证明。\n\n## 风险边界\n\n- 产区只是线索，不是鉴定结论。\n- 野生、沉水、奇楠、老料、顶级产区等市场词不能单独作为证据。\n- 涉及跨境、野生来源或高价藏品时，应结合 [[CITES]]、[[IUCN]]、来源凭证和检测资料。\n\n## 当前资料缺口\n\n- 电白/茂名、海南和国外产区的最新产业资料仍需继续补充。\n- 各产区香韵描述需要更多可核对的商品详情、行业资料和复闻记录。\n\n## 相关\n\n[[沉香树种]]、[[Aquilaria sinensis]]、[[Aquilaria crassna]]、[[Aquilaria malaccensis]]、[[Gyrinops]]、[[鉴别风险]]\n`
    },
    {
      file: "concepts/香韵解释.md",
      index: "- [[香韵解释]] - 清甜、凉意、奶韵、药感、木质、花蜜、清雅等香韵选项的中文解释。",
      content:
        fm(["concept", "香韵", "选项"], allSources) +
        `# 香韵解释

香韵解释用于把用户选择的气味偏好转成可理解的中文表达，而不是把香韵词当成鉴定结论。沉香的气味会受树种、产区口径、结香方式、含油状态、加热方式、温度和个人嗅觉经验影响。

## 常见选项

- 清甜：偏干净、轻盈、带自然甜感，适合新手、茶室、书房和日常闻香。
- 凉意：鼻腔或后段有清透感，常被用于描述星洲系、部分高油脂香材或较有穿透力的香气，但不能仅凭凉意判断产区。
- 奶韵：柔和、圆润、带乳脂或脂粉感，适合想要温润、不尖锐体验的用户。
- 药感：带草药、苦甘、辛凉或传统药香联想，适合进阶闻香说明；对外表达时不能延伸成医疗功效承诺。
- 木质：干净木气、老木、温木或焚熏后的木香骨架，是沉香解释中的基础维度。
- 花蜜：带花香、蜜甜、果甜联想，适合解释惠安系或清雅型体验，但仍需实物复闻佐证。
- 清雅：强调克制、干净、层次细，不追求强烈冲击，适合静坐、书房、茶席和礼赠语境。

## 回答边界

- 香韵词只能描述体验，不能直接证明真假、等级、产区或价格。
- 用户问香韵时，应结合[[闻香场景]]、[[熏闻方式]]和[[气味强度]]解释。
- 涉及药感、助眠、静心时，只能说传统使用或主观体验，不能承诺疗效。

## 相关

[[闻香体验]]、[[产区对比]]、[[合规表达]]、[[真假鉴别]]
`
    },
    {
      file: "concepts/闻香场景.md",
      index: "- [[闻香场景]] - 茶室、书房、静坐、助眠、商务空间、送礼、自用、收藏等使用场景。",
      content:
        fm(["concept", "场景", "选项"], allSources) +
        `# 闻香场景

闻香场景用于把用户的用途选项转成产品建议和表达方式。场景不是品质证据，而是帮助选择香韵、强度、形态和预算的线索。

## 场景选项

- 茶室：适合清甜、清雅、花蜜、木质等不压茶气的方向；熏闻方式可偏隔火、电熏或低温线香。
- 书房：适合安静、干净、留香不过分扰人的香材、线香或电熏。
- 静坐：适合清雅、木质、轻柔或平衡强度，表达重点放在仪式感和主观安定体验。
- 助眠：只能作为放松场景描述，避免承诺治疗失眠；宜轻柔、低温、少烟。
- 商务空间：适合稳定、干净、有辨识度但不过分浓烈的气味，重视来源记录和稳定供应。
- 送礼：重点是包装、来源说明、接受门槛和风险边界，优先选择解释清楚、形态稳定的产品。
- 自用：可按预算小样试闻，逐步确认香韵偏好。
- 收藏：强调来源记录、检测佐证、保存条件和合规证明，不承诺升值。

## 相关

[[香韵解释]]、[[熏闻方式]]、[[气味强度]]、[[产品形态]]、[[预算层级]]
`
    },
    {
      file: "concepts/熏闻方式.md",
      index: "- [[熏闻方式]] - 电熏、隔火、线香、随身闻香的差异和适用边界。",
      content:
        fm(["concept", "熏闻", "选项"], allSources) +
        `# 熏闻方式

熏闻方式会明显影响沉香的气味表现。回答时应先确认用户是想要稳定日用、仪式体验、空间扩香，还是随身轻闻。

## 方式选项

- 电熏：温度可控，适合新手和日常复闻；低温更容易观察清甜、花蜜、奶韵，高温更容易出现木质、药感和烟火感。
- 隔火：仪式感强，适合茶席、静坐和进阶体验；需要控制火候，避免过热焦糊。
- 线香：使用方便，适合空间氛围和礼赠，但配方、粘粉、燃烧状态会影响真实沉香感。
- 随身闻香：常见于手串、香囊、香材小件，适合轻闻和社交距离内体验；要注意汗液、香水和潮湿污染。

## 回答边界

- 熏闻方式不是等级证明。
- 香材、香粉、线香、手串要分开讲，避免把不同形态混成一个结论。
- 涉及保养时连接[[工艺保养]]。

## 相关

[[工艺保养]]、[[香韵解释]]、[[产品形态]]、[[闻香场景]]
`
    },
    {
      file: "concepts/气味强度.md",
      index: "- [[气味强度]] - 轻柔、平衡、穿透力强三类强度偏好的导购解释。",
      content:
        fm(["concept", "香韵", "选项"], allSources) +
        `# 气味强度

气味强度描述用户希望香气在空间和鼻腔中的存在感。它受香材含油、形态、用量、加热温度、空间大小和个人嗅觉阈值共同影响。

## 强度选项

- 轻柔：适合新手、助眠、静坐、书房和近距离闻香；建议少量、低温、短时。
- 平衡：适合多数日常场景，在清甜、木质、花蜜和药感之间保持可接受的存在感。
- 穿透力强：适合较大空间、商务空间或喜欢明确存在感的用户；要提醒可能压过茶气或让新手觉得刺激。

## 回答边界

- 强度不等于品质，高强度不必然更贵。
- 温度过高可能把细腻香韵烧成焦糊或烟火味。

## 相关

[[香韵解释]]、[[熏闻方式]]、[[闻香场景]]
`
    },
    {
      file: "concepts/工艺保养.md",
      index: "- [[工艺保养]] - 香材、线香、香粉、手串和摆件的使用保养边界。",
      content:
        fm(["concept", "保养", "选项"], allSources) +
        `# 工艺保养

工艺保养用于回答使用、保存和日常维护问题。沉香相关产品形态不同，保养重点也不同。

## 使用保养

- 香材：避潮、避暴晒、避香水和强气味污染；熏闻时从低温少量开始。
- 香粉：注意密封、防潮和洁净取用；不建议混入来源不明粉末。
- 线香：保持干燥，观察燃烧是否稳定；少烟、无刺鼻异味更适合日用。
- 手串：避免水洗、汗液长期浸润、香水和化学清洁剂；盘玩以干净手部和自然佩戴为主。
- 摆件和收藏藏品：重视湿度、温度、避光、虫霉风险和来源记录保存。

## 回答边界

- 保养不能替代真假鉴别。
- 不建议用破坏性方法测试，如火烧、泡水、刮削高价藏品。

## 相关

[[产品形态]]、[[熏闻方式]]、[[真假鉴别]]
`
    },
    {
      file: "concepts/产品形态.md",
      index: "- [[产品形态]] - 香材、手串、香粉、线香、摆件、收藏藏品的选择逻辑。",
      content:
        fm(["concept", "产品", "选项"], allSources) +
        `# 产品形态

产品形态决定用户该如何闻、如何保存、如何判断风险。回答导购问题时，应先区分用户选择的是香材、手串、香粉、线香、摆件还是收藏藏品。

## 形态选项

- 香材：适合复闻和进阶体验，重点看香韵、结香状态、来源记录和熏闻表现。
- 手串：适合佩戴和随身闻香，重点看材质、工艺、油脂表现、佩戴习惯和保养。
- 香粉：适合电熏、隔火或制作场景，重点看来源、纯度、气味干净度和混粉风险。
- 线香：适合日用和送礼，重点看配方、燃烧状态、烟感和稳定供应。
- 摆件：适合展示和空间叙事，重点看完整性、工艺、气味真实性和保存条件。
- 收藏藏品：重点看来源记录、检测佐证、合法来源证明和长期保存，不承诺投资收益。

## 相关

[[预算层级]]、[[购买偏好]]、[[工艺保养]]、[[真假鉴别]]
`
    },
    {
      file: "concepts/预算层级.md",
      index: "- [[预算层级]] - 500 入门、3000 进阶、20000 高阶、收藏级的购买建议边界。",
      content:
        fm(["concept", "预算", "选项"], allSources) +
        `# 预算层级

预算层级用于把用户价格预期转成风险可控的购买路径。预算不是品质结论，尤其不能把高价直接等同于真货或更适合。

## 预算选项

- 500 入门试香：优先小样、线香、香粉或低风险香材体验，目标是建立香韵偏好。
- 3000 进阶预算：可尝试更稳定的香材、手串或组合装，重点看复闻表现和来源说明。
- 20000 高阶预算：需要更完整的来源记录、检测佐证、商家信誉和复闻确认。
- 收藏级：必须强调合法来源证明、保存条件、检测资料和风险边界，不承诺升值。

## 回答边界

- 不给投资回报承诺。
- 不用单一产区、沉水、野生、奇楠等词直接证明价格合理。

## 相关

[[价格等级]]、[[产品形态]]、[[购买偏好]]、[[真假鉴别]]
`
    },
    {
      file: "concepts/购买偏好.md",
      index: "- [[购买偏好]] - 新手稳妥、小幅升级、重视稀缺性的导购口径。",
      content:
        fm(["concept", "导购", "选项"], allSources) +
        `# 购买偏好

购买偏好用于控制推荐的风险程度，而不是直接推荐某个最高价商品。

## 偏好选项

- 新手稳妥：优先小规格、可复闻、解释清楚、来源记录完整的产品，避免高价故事型商品。
- 愿意小幅升级：在已有香韵偏好上提高预算，比较不同形态和强度，不急于收藏级。
- 重视稀缺性：可以讨论产区、树种、结香和收藏属性，但必须同时提醒来源记录、检测佐证、合法来源证明和保存风险。

## 相关

[[预算层级]]、[[价格等级]]、[[产品形态]]、[[合规表达]]
`
    },
    {
      file: "concepts/价格等级.md",
      index: "- [[价格等级]] - 沉香价格受形态、香韵、来源、结香、检测和合规资料共同影响。",
      content:
        fm(["concept", "价格", "选项"], allSources) +
        `# 价格等级

价格等级用于解释为什么沉香价格差异大，以及购买时应看哪些证据。当前知识库中的贸易、保护和鉴别风险资料都提示：高价伴随更高的真假、来源和合规风险。

## 影响因素

- 产品形态：香材、手串、香粉、线香、摆件、收藏藏品的定价逻辑不同。
- 香韵表现：清甜、凉意、奶韵、药感、木质、花蜜、清雅等只能描述体验，不能单独定级。
- 来源记录：产区、树种、商家记录、合法来源证明会影响可信度。
- 结香状态：油脂分布、香气层次、熏闻稳定性和处理方式都重要。
- 检测佐证：高价或对外宣传场景应结合检测资料和可追溯文件。

## 风险表达

- 沉水、野生、奇楠、老料、顶级产区等词不能单独证明价格。
- 收藏级不等于投资品，不能承诺升值。

## 相关

[[预算层级]]、[[购买偏好]]、[[真假鉴别]]、[[沉香贸易]]
`
    },
    {
      file: "concepts/真假鉴别.md",
      index: "- [[真假鉴别]] - 真伪、来源、检测、复闻和高风险宣传词的判断框架。",
      content:
        fm(["concept", "鉴别", "选项"], allSources) +
        `# 真假鉴别

真假鉴别是用户购买沉香时的高风险主题。当前知识库应给出判断框架，而不是隔空下鉴定结论。

## 判断框架

- 看来源：商家记录、产区口径、合法来源证明、交易票据和可追溯资料。
- 看实物：颜色、油脂、纹理、重量、气味变化和熏闻表现要综合判断。
- 看检测：高价购买、收藏或对外宣传时，应要求检测佐证。
- 看表达：警惕绝对化词汇，例如包真、顶级、稳赚、必升值、绝对野生。
- 看场景：香材、手串、香粉、线香的鉴别重点不同，不能用一个标准套所有形态。

## 回答边界

- 不能仅凭图片、产区名、沉水或香韵词给出最终真伪结论。
- 可建议用户补充实物复闻、来源记录、检测资料和合法来源证明。

## 相关

[[鉴别风险]]、[[价格等级]]、[[产品形态]]、[[合规表达]]
`
    },
    {
      file: "concepts/CITES.md",
      index: "- [[CITES]] - 沉香相关物种跨境贸易和附录管理的核心合规入口。",
      content:
        fm(["concept", "合规"], allSources) +
        `# CITES\n\nCITES 是濒危野生动植物种国际贸易公约。沉香相关的 [[Aquilaria]] 和 [[Gyrinops]] 材料涉及国际贸易、持有、进出口和证明文件时，应优先核对 CITES 附录、物种清单和当地法规。\n\n## 当前知识库结论\n\n- 原始资料包含 CITES 附录页和 CITES 物种清单页。\n- [[Aquilaria sinensis]] 资料提到所有 Aquilaria 亚种/相关项受附录 II 管理的香港法规语境。\n- CITES 信息可能随时间更新；生产和跨境导购场景必须以最新官方资料为准。\n\n## 回答边界\n\n- 可以提醒用户关注合法来源证明、进出口许可和购买记录。\n- 不应给出确定法律意见；涉及交易、跨境运输或商业库存时，需要查最新官方规则。\n\n## 相关\n\n[[合规表达]]、[[沉香贸易]]、[[濒危保护]]、[[Aquilaria]]、[[Gyrinops]]\n`
    },
    {
      file: "concepts/濒危保护.md",
      index: "- [[濒危保护]] - 沉香相关树种的资源压力、保护状态和非法采伐风险。",
      content:
        fm(["concept", "保护"], allSources) +
        `# 濒危保护\n\n当前资料显示，沉香相关树种因为高价值香材贸易、野外过度砍伐和栖息地压力而面临保护风险。IUCN、CITES、Kew 和香港报道都为这一主题提供证据入口。\n\n## 要点\n\n- [[Aquilaria malaccensis]]、[[Aquilaria crassna]]、[[Aquilaria sinensis]] 等资料均涉及威胁或保护状态。\n- 香港报道强调本地沉香树因非法砍伐而接近灭绝，体现高价值香材背后的生态压力。\n- 保护状态不是静态信息，需定期核对最新 IUCN、CITES 和地方制度。\n\n## 导购边界\n\n购买和宣传时应重视来源记录、合法采收、种植来源和可追溯性，不应浪漫化非法野生采集。\n\n## 相关\n\n[[IUCN]]、[[CITES]]、[[香港沉香树]]、[[合规表达]]\n`
    },
    {
      file: "concepts/沉香贸易.md",
      index: "- [[沉香贸易]] - 沉香使用史、经济价值、国际贸易和风险表达。",
      content:
        fm(["concept", "贸易"], allSources) +
        `# 沉香贸易\n\n沉香因香料、宗教、传统药用和奢侈消费而具有长期贸易史。当前资料包括使用与贸易史、CITES 资料、物种保护资料和中文百科中关于投资骗局风险的提示。\n\n## 要点\n\n- 贸易价值来自稀缺性、香气文化和树脂木材的特殊用途。\n- 高价值贸易带来过度采伐、非法流通和保护压力。\n- 种植和人工诱导结香可成为可持续供应方向，但不能承诺高额投资回报。\n\n## 相关\n\n[[CITES]]、[[濒危保护]]、[[合规表达]]、[[鉴别风险]]\n`
    },
    {
      file: "concepts/鉴别风险.md",
      index: "- [[鉴别风险]] - 真伪、品质、产区、投资和药用宣传中的风险边界。",
      content:
        fm(["concept", "风险"], allSources) +
        `# 鉴别风险\n\n当前 raw 资料从多个角度提示沉香判断风险：树种和产地不能直接证明品质，沉香树不结香就没有香材价值，投资种植存在骗局风险，药用和功效表达需要合规边界。\n\n## 稳妥判断\n\n- 看树种、来源、结香方式、实物复闻、检测资料和合法来源证明。\n- 不把“野生”“沉水”“顶级产区”“奇楠”等词当成单独证据。\n- 英文来源中的保护状态、分类和法规内容要翻译成中文解释，并提示时效性。\n\n## 相关\n\n[[沉香]]、[[CITES]]、[[合规表达]]、[[沉香贸易]]\n`
    },
    {
      file: "concepts/合规表达.md",
      index: "- [[合规表达]] - 面向用户、导购和文案时的中文表达边界。",
      content:
        fm(["concept", "合规"], allSources) +
        `# 合规表达\n\n沉香可介绍传统使用、香气体验、空间审美和文化价值；但面向消费者时，不应承诺医疗疗效、治疗效果、投资收益或绝对鉴定结论。\n\n## 必须遵守\n\n- 无论检索到的资料是中文还是英文，RAG 和 AI Agent 都必须用中文回答。\n- 法规、保护状态和药用信息要用“资料显示/传统语境/需要核对最新官方信息”等审慎措辞。\n- 不把英文原文直接塞进答案；必要时只保留拉丁学名、CITES、IUCN、Kew 等专名。\n\n## 可以表达\n\n- 适合闻香、茶席、书房、展陈、文化讲解。\n- 与传统香料、药用文献、贸易历史相关。\n- 购买时建议关注可追溯来源、合法证明和实物复闻。\n\n## 避免表达\n\n- 治病、包治、抗癌、降血压、治疗焦虑失眠。\n- 包升值、稳赚、绝对野生、绝对顶级。\n- 未核实的具体法规结论或跨境交易建议。\n\n## 相关\n\n[[CITES]]、[[鉴别风险]]、[[沉香贸易]]、[[濒危保护]]\n`
    },
    {
      file: "concepts/资料边界.md",
      index: "- [[资料边界]] - 处理英文来源、重复来源和非沉香资料时的使用规则。",
      content:
        fm(["concept", "工作规范"], allSources) +
        `# 资料边界\n\n当前 raw 中既有中文百科、英文维基、Kew、IUCN、CITES、报道和论文，也有一篇与沉香关系较弱的多感觉整合论文。知识库需要区分主源、辅助源和外围参考。\n\n## 使用规则\n\n- 主源：沉香属/拟沉香属、沉香、CITES、IUCN、Kew、香港沉香树、使用与贸易史。\n- 辅助源：重复的中文维基条目、备份条目和宽泛检索结果。\n- 外围参考：多感觉整合论文，仅可用于闻香体验或感知研究类问题，不能作为沉香物种、贸易、药用事实依据。\n- 英文原文只做证据来源，回答必须中文化。\n\n## 相关\n\n[[合规表达]]、[[沉香]]、[[沉香树种]]\n`
    },
    {
      file: "concepts/人工种植沉香.md",
      index: "- [[人工种植沉香]] - 以栽培和人工诱导结香为核心的可持续供应口径。",
      content:
        fm(["concept", "来源"], allSources) +
        `# 人工种植沉香\n\n人工种植沉香指通过栽培沉香相关树种，并通过自然管理或人工诱导方式形成树脂木材的供应路径。当前资料把人工感染、外部创伤、可持续采脂和种植计划作为缓解野外资源压力的重要方向。\n\n## 要点\n\n- 种植不等于低品质，野生也不等于必然更好。\n- 品质仍取决于树种、树龄、诱导方式、树脂沉积、加工和复闻表现。\n- 导购时可强调可追溯、合规、稳定供应，但不能承诺投资回报。\n\n## 相关\n\n[[结香]]、[[野生沉香]]、[[沉香贸易]]、[[合规表达]]\n`
    },
    {
      file: "concepts/野生沉香.md",
      index: "- [[野生沉香]] - 稀缺性、非法采伐和合规风险并存的来源口径。",
      content:
        fm(["concept", "来源"], allSources) +
        `# 野生沉香\n\n野生沉香常被市场赋予稀缺性和故事性，但当前资料更强调其背后的非法采伐、资源枯竭和保护压力。涉及野生来源时，必须把审美叙事与合法来源证明分开。\n\n## 要点\n\n- 不应把野生直接等同于高品质或高价值。\n- 高价值野生材料需要来源记录、合法证明、检测资料和实物复闻。\n- 对外表达应避免鼓励非法采伐或浪漫化濒危资源消耗。\n\n## 相关\n\n[[人工种植沉香]]、[[CITES]]、[[濒危保护]]、[[合规表达]]\n`
    },
    {
      file: "concepts/沉香使用史.md",
      index: "- [[沉香使用史]] - 沉香在香料、宗教、药用传统和贸易中的历史使用脉络。",
      content:
        fm(["concept", "历史"], allSources) +
        `# 沉香使用史\n\n沉香长期用于香料、宗教仪式、传统药用和高价值贸易。当前资料中的使用与贸易史可作为文化讲解和展陈叙事来源，但不能替代现代法规、药品监管或交易合规判断。\n\n## 使用方式\n\n- 可用于解释沉香为什么在东亚、东南亚和国际贸易中具有高价值。\n- 可用于品牌文化、文博展陈和香文化普及。\n- 不应据此承诺疗效、升值或绝对品质。\n\n## 相关\n\n[[沉香贸易]]、[[合规表达]]、[[CITES]]\n`
    },
    {
      file: "concepts/闻香体验.md",
      index: "- [[闻香体验]] - 处理闻香主观感受、感知研究和英文外围资料的入口。",
      content:
        fm(["concept", "感知"], allSources) +
        `# 闻香体验\n\n闻香体验是沉香知识库中的感知与表达层，关注用户如何描述香气、空间氛围和身体感受。当前多感觉整合论文只能作为外围参考，不能作为沉香物种、贸易或药用事实依据。\n\n## 使用边界\n\n- 可用于解释香气体验为什么具有主观性和场景差异。\n- 不应把心理或神经机制研究直接转写成沉香疗效承诺。\n- 英文论文内容如被引用，必须转述为中文并标明只是外围参考。\n\n## 相关\n\n[[资料边界]]、[[合规表达]]、[[沉香]]\n`
    }
  ];
}

function entityPages(rawFiles) {
  const allSources = rawFiles;
  return [
    {
      file: "entities/Aquilaria.md",
      index: "- [[Aquilaria]] - 沉香属，沉香主要来源类群之一。",
      content:
        fm(["entity", "属"], allSources) +
        `# Aquilaria\n\nAquilaria 即沉香属，是瑞香科中的一类树木，也是沉香最重要的植物来源之一。资料显示其分布于东南亚、南亚部分地区和中国南部等区域，与 [[Gyrinops]] 一起被视为沉香生产核心类群。\n\n## 要点\n\n- 常见中文口径包括沉香属、白木香、土沉香等具体物种或地方名称。\n- 属内物种较多，Kew/POWO 适合核对接受名与异名。\n- 过度采伐和沉香贸易使多种 Aquilaria 面临保护压力。\n\n## 相关\n\n[[Aquilaria sinensis]]、[[Aquilaria malaccensis]]、[[Aquilaria crassna]]、[[CITES]]\n`
    },
    {
      file: "entities/Gyrinops.md",
      index: "- [[Gyrinops]] - 拟沉香属，沉香来源类群之一。",
      content:
        fm(["entity", "属"], allSources) +
        `# Gyrinops\n\nGyrinops 即拟沉香属，与 [[Aquilaria]] 同属沉香贸易和香料生产中需要关注的植物类群。Kew 与英文资料提供了物种列表和分类线索。\n\n## 要点\n\n- Gyrinops 可产生 agarwood，常在 CITES 和沉香贸易语境中与 Aquilaria 并列讨论。\n- 与具体商品品质的关系需要进一步结合物种、来源、结香和实物复闻判断。\n\n## 相关\n\n[[Aquilaria]]、[[沉香树种]]、[[CITES]]、[[濒危保护]]\n`
    },
    {
      file: "entities/Aquilaria sinensis.md",
      index: "- [[Aquilaria sinensis]] - 土沉香/白木香，中国与香港语境中的关键树种。",
      content:
        fm(["entity", "物种"], allSources) +
        `# Aquilaria sinensis\n\nAquilaria sinensis 是中国语境中常见的土沉香/白木香相关物种。资料涉及形态描述、香港名称与本地树种、传统使用、树脂采集、保护和 CITES 附录 II 管理。\n\n## 要点\n\n- 中文资料称其为土沉香、白木香等，英文资料也提到 Chinese Agarwood / Chinese Eaglewood。\n- 香港相关资料强调该树与本地历史文化、非法砍伐和濒危保护相关。\n- 可产生用于香料和传统药用语境的树脂木材，但对消费者不能承诺治疗效果。\n\n## 相关\n\n[[土沉香]]、[[香港沉香树]]、[[CITES]]、[[濒危保护]]\n`
    },
    {
      file: "entities/Aquilaria malaccensis.md",
      index: "- [[Aquilaria malaccensis]] - 沉香贸易中的重要树种，保护压力显著。",
      content:
        fm(["entity", "物种"], allSources) +
        `# Aquilaria malaccensis\n\nAquilaria malaccensis 是沉香贸易中非常重要的树种。资料强调其 agarwood 用途、威胁和保护议题，常被视为高质量沉香历史供应的重要来源之一。\n\n## 要点\n\n- 与香料、熏香和沉香贸易密切相关。\n- 过度采伐和野外资源压力是核心风险。\n- 具体商品是否高品质仍需看实物、来源、结香和处理方式。\n\n## 相关\n\n[[Aquilaria]]、[[沉香贸易]]、[[CITES]]、[[濒危保护]]\n`
    },
    {
      file: "entities/Aquilaria crassna.md",
      index: "- [[Aquilaria crassna]] - 东南亚沉香来源物种，资料强调濒危和树脂形成。",
      content:
        fm(["entity", "物种"], allSources) +
        `# Aquilaria crassna\n\nAquilaria crassna 是东南亚沉香来源物种之一。资料提到其处于濒危状态，并说明它可产生用于香水和熏香的树脂心材。\n\n## 要点\n\n- 结香可与感染或外部刺激有关。\n- 作为具体树种，应与产地、结香方式、保护状态和贸易合规一起理解。\n\n## 相关\n\n[[Aquilaria]]、[[结香]]、[[濒危保护]]\n`
    },
    {
      file: "entities/土沉香.md",
      index: "- [[土沉香]] - A. sinensis 的中文常用口径，连接白木香、香港沉香树和保护议题。",
      content:
        fm(["entity", "中文名"], allSources) +
        `# 土沉香\n\n土沉香是中文资料中与 [[Aquilaria sinensis]] 紧密相关的名称，也常与白木香、香港沉香树和传统药用/香料用途相连。\n\n## 要点\n\n- 可作为解释中国本土沉香树种的入口。\n- 使用时应区分树种、香材、药材和商品名。\n- 保护与采伐问题需要结合当地法规和 CITES 资料。\n\n## 相关\n\n[[Aquilaria sinensis]]、[[香港沉香树]]、[[CITES]]\n`
    },
    {
      file: "entities/香港沉香树.md",
      index: "- [[香港沉香树]] - 与 A. sinensis、非法采伐和本地保护相关的文化生态实体。",
      content:
        fm(["entity", "地区"], allSources) +
        `# 香港沉香树\n\n香港沉香树主要连接 [[Aquilaria sinensis]]、本地历史文化、非法砍伐和濒危保护议题。英文报道强调这些树正接近灭绝，反映沉香高价值贸易造成的保护压力。\n\n## 要点\n\n- 可用于讲解沉香与香港地名、香料贸易和生态保护的关系。\n- 不适合被包装成“野生更好”的销售故事；应转向合法来源和保护意识。\n\n## 相关\n\n[[Aquilaria sinensis]]、[[土沉香]]、[[濒危保护]]、[[合规表达]]\n`
    },
    {
      file: "entities/Kew POWO.md",
      index: "- [[Kew POWO]] - 核对 Aquilaria/Gyrinops 分类、异名和接受名的植物学来源。",
      content:
        fm(["entity", "资料源"], allSources) +
        `# Kew POWO\n\nKew Plants of the World Online 是核对植物分类、接受名、异名和分布信息的重要来源。当前 raw 中有 Aquilaria 与 Gyrinops 的 Kew 检索资料。\n\n## 使用方式\n\n- 用于核对树种名称和异名，不直接判断商品价值。\n- 与 CITES、IUCN 信息配合使用，可区分分类事实、保护状态和贸易管制。\n\n## 相关\n\n[[Aquilaria]]、[[Gyrinops]]、[[沉香树种]]\n`
    },
    {
      file: "entities/IUCN.md",
      index: "- [[IUCN]] - 核对沉香相关物种保护状态的来源。",
      content:
        fm(["entity", "资料源"], allSources) +
        `# IUCN\n\nIUCN 红色名录用于核对物种受威胁等级和保护状态。当前 raw 中有 IUCN 检索资料和若干物种页面引用。\n\n## 使用方式\n\n- 回答保护状态时，应说明信息可能更新，必要时核对最新 IUCN 页面。\n- IUCN 保护状态不等于 CITES 贸易管制，两者需要分开解释。\n\n## 相关\n\n[[濒危保护]]、[[CITES]]、[[Aquilaria sinensis]]、[[Aquilaria crassna]]\n`
    },
    {
      file: "entities/沉香属.md",
      index: "- [[沉香属]] - Aquilaria 的中文别名页，指向沉香属分类和物种资料。",
      content:
        fm(["entity", "属", "别名"], allSources) +
        `# 沉香属\n\n沉香属是 [[Aquilaria]] 的中文名称。为避免中文资料和英文资料分散，本页作为别名页，主要指向 [[Aquilaria]]、[[沉香树种]] 与具体物种页面。\n\n## 相关\n\n[[Aquilaria]]、[[Aquilaria sinensis]]、[[Aquilaria malaccensis]]、[[Aquilaria crassna]]、[[Kew POWO]]\n`
    }
  ];
}

async function main() {
  const rawFiles = await listRawFiles();
  await mkdir(wikiRoot, { recursive: true });

  for (const dir of ["concepts", "entities", "sources"]) {
    await rm(path.join(wikiRoot, dir), { recursive: true, force: true });
    await mkdir(path.join(wikiRoot, dir), { recursive: true });
  }
  await mkdir(path.join(wikiRoot, "outputs"), { recursive: true });

  const sourcePages = [];
  for (const rawFile of rawFiles) {
    const content = await readFile(path.join(rawRoot, rawFile), "utf8");
    const page = sourcePage(rawFile, content);
    sourcePages.push({ ...page, rawFile });
    await writeManagedPage(`sources/${page.wikiName}.md`, page.content);
  }

  const concepts = conceptPages(rawFiles);
  const entities = entityPages(rawFiles);
  for (const page of [...concepts, ...entities]) {
    await writeManagedPage(page.file, page.content);
  }

  const index =
    fm(["index"], []) +
    `# Index\n\n## Sources\n\n${sourcePages
      .map((page) => `- [[${page.wikiName}]] - ${page.summary}`)
      .join("\n")}\n\n## Concepts\n\n${concepts.map((page) => page.index).join("\n")}\n\n## Entities\n\n${entities
      .map((page) => page.index)
      .join("\n")}\n\n## Outputs\n\n`;

  const log =
    fm(["log"], []) +
    `# Log\n\n## [${today}] ingest | 重新摄入当前 raw 资料\n\n- 扫描 \`knowledge/raw/\` 当前 ${rawFiles.length} 个 Markdown 源文件。\n- 为每个源文件重建 \`wiki/sources/\` 摘要页。\n- 重建沉香物种、CITES、IUCN、Kew、保护、贸易、合规和资料边界等核心页面。\n- 约定：即使源文件为英文，RAG 和 AI Agent 也必须使用中文回答。\n`;

  await writeManagedPage("index.md", index);
  await writeManagedPage("log.md", log);

  console.log(
    JSON.stringify(
      {
        rawFiles: rawFiles.length,
        sourcePages: sourcePages.length,
        conceptPages: concepts.length,
        entityPages: entities.length,
        totalPages: sourcePages.length + concepts.length + entities.length + 2
      },
      null,
      2
    )
  );
}

await main();
