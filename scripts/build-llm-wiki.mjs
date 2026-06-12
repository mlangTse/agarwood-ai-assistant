import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const rawRoot = path.join(root, "knowledge", "raw");
const wikiRoot = path.join(root, "knowledge", "wiki");
const today = new Date().toISOString().slice(0, 10);

const sourceSummaryByFile = {
  "沉香 - 维基百科，自由的百科全书.md": {
    title: "沉香",
    summary: "中文资料介绍沉香的种类、结香机理、鉴别、致香成分、香料、传统药用语境与投资骗局风险。",
    links: ["沉香", "结香", "真假鉴别", "合规表达"]
  },
  "沉香属 - 维基百科，自由的百科全书.md": {
    title: "沉香属",
    summary: "中文资料介绍沉香属物种和保育状况，可与 Kew、CITES、IUCN 资料互相校验。",
    links: ["沉香树种", "Aquilaria", "濒危保护"]
  },
  "沉香树 - 维基百科，自由的百科全书.md": {
    title: "沉香树",
    summary: "中文资料介绍沉香树用途、类似品种和参考文献，可用于解释树、树脂与香材的关系。",
    links: ["沉香", "沉香树种", "结香"]
  },
  "土沉香 - 维基百科，自由的百科全书.md": {
    title: "土沉香",
    summary: "中文资料介绍土沉香的异名、特征、用途、保护情况和类似品种，是 A. sinensis 中文口径的重要来源。",
    links: ["土沉香", "Aquilaria sinensis", "濒危保护"]
  },
  "电白区 - 维基百科，自由的百科全书.md": {
    title: "电白区",
    summary: "电白区资料用于补充电白、茂名地域背景，可服务地方产区、礼赠和文旅展陈口径；具体沉香产业事实仍需地方产业资料佐证。",
    links: ["产区对比", "闻香场景", "合规表达"]
  },
  "茂名市 - 维基百科，自由的百科全书.md": {
    title: "茂名市",
    summary: "茂名市资料用于补充广东西部地域背景。用于沉香产区表达时，应区分行政区资料与沉香产业资料。",
    links: ["产区对比", "资料边界"]
  },
  "Agarwood.md": {
    title: "Agarwood 沉香总论",
    summary: "英文资料介绍 agarwood/oud 的形成、用途、香气、价格、贸易、CITES 和文化背景，适合补充香韵、价格等级、工艺和合规边界。",
    links: ["沉香", "香韵解释", "价格等级", "沉香贸易", "CITES"]
  },
  "Appendices  CITES.md": {
    title: "CITES 附录",
    summary: "CITES 附录解释国际濒危物种贸易管理框架，是判断沉香属、拟沉香属材料跨境合规的重要背景。",
    links: ["CITES", "合规表达", "沉香贸易"]
  },
  "Checklist of CITES species.md": {
    title: "CITES 物种清单",
    summary: "CITES 物种清单用于核对受管制物种；使用时应结合 Aquilaria、Gyrinops 专门条目检索。",
    links: ["CITES", "合规表达"]
  },
  "The IUCN Red List of Threatened Species.md": {
    title: "IUCN 红色名录检索",
    summary: "IUCN 红色名录检索结果用于核对沉香相关物种保护状态，具体结论需回到对应物种页面。",
    links: ["IUCN", "濒危保护", "沉香树种"]
  },
  "Kew Science.md": {
    title: "Kew Science: Aquilaria",
    summary: "Kew POWO 的 Aquilaria 检索结果和分类资料，适合核对沉香属物种、异名和植物分类口径。",
    links: ["Kew POWO", "Aquilaria", "沉香树种"]
  },
  "Kew Science 1.md": {
    title: "Kew Science: Gyrinops",
    summary: "Kew POWO 的 Gyrinops 检索结果，适合核对拟沉香属物种和分类口径。",
    links: ["Kew POWO", "Gyrinops", "Aquilaria"]
  },
  "Aquilaria.md": {
    title: "Aquilaria 沉香属",
    summary: "Aquilaria 是沉香主要基原类群之一，与 Gyrinops 共同构成香料级沉香的重要植物来源。",
    links: ["Aquilaria", "沉香属", "Gyrinops", "沉香树种"]
  },
  "Gyrinops.md": {
    title: "Gyrinops 拟沉香属",
    summary: "拟沉香属与沉香属同为沉香重要来源类群，资料涉及沉香生产和物种列表。",
    links: ["Gyrinops", "沉香树种", "Aquilaria"]
  },
  "Aquilaria sinensis.md": {
    title: "Aquilaria sinensis 土沉香/白木香",
    summary: "A. sinensis 是中国语境中的土沉香、白木香，资料涉及香港、传统用途、树脂采集、保护与 CITES 附录 II 管理。",
    links: ["Aquilaria sinensis", "土沉香", "香港沉香树", "CITES"]
  },
  "Aquilaria malaccensis.md": {
    title: "Aquilaria malaccensis",
    summary: "A. malaccensis 是沉香贸易中极重要的树种，资料涉及用途、威胁、保护和过度采伐问题。",
    links: ["Aquilaria malaccensis", "沉香树种", "濒危保护", "沉香贸易"]
  },
  "Aquilaria crassna.md": {
    title: "Aquilaria crassna",
    summary: "A. crassna 是东南亚沉香来源树种之一，资料强调濒危状态、树脂心材用途与人工诱导或感染形成沉香的背景。",
    links: ["Aquilaria crassna", "沉香树种", "结香"]
  },
  "Trees That Gave Hong Kong Its Name Are Nearing Extinction.md": {
    title: "香港沉香树濒危报道",
    summary: "报道指出给香港带来名称联想的沉香树正接近灭绝，强调非法砍伐、保护压力和本地生态文化价值。",
    links: ["香港沉香树", "Aquilaria sinensis", "濒危保护"]
  },
  "History of Use and Trade of Agarwood - Ethnobotany and Economic Botany.md": {
    title: "沉香使用与贸易史",
    summary: "资料从民族植物学和经济植物学角度讨论 agarwood 的使用、贸易、历史流通和经济价值。",
    links: ["沉香贸易", "沉香使用史", "合规表达"]
  },
  "Kōdō.md": {
    title: "Kōdō 香道",
    summary: "香道资料适合补充闻香场景、隔火体验、香席文化、香材等级和审美表达，但不能转写成疗效承诺。",
    links: ["闻香场景", "熏闻方式", "沉香使用史", "合规表达"]
  }
};

const conceptDefinitions = [
  {
    file: "concepts/沉香.md",
    tags: ["concept", "基础"],
    index: "[[沉香]] - 树脂浸润木材的总入口，解释沉香是什么、如何形成、如何合规表达。",
    body: `# 沉香

沉香是沉香属（[[Aquilaria]]）和拟沉香属（[[Gyrinops]]）等植物在受伤、感染或外部刺激后形成的含树脂芳香木材。它不是普通木头天然自带香气，也不是整棵树都等于沉香。

## 知识库口径

- 核心是[[结香]]：树体因真菌感染、创伤或人工诱导等压力产生树脂，树脂浸润木质部。
- 当前资料主线集中在 [[Aquilaria sinensis]]、[[Aquilaria malaccensis]]、[[Aquilaria crassna]] 和 [[Gyrinops]]。
- 高价沉香与濒危保护、非法采伐、跨境贸易和 [[CITES]] 管理密切相关。
- 英文来源只能作为证据来源，回答必须转成中文解释，不能把英文或 raw 片段直接塞给用户。

## 回答边界

- 产区名、沉水、野生、奇楠等市场词不能单独证明品质。
- 传统药用资料只能作为历史或文化背景，不能承诺医疗功效。
- 高价或收藏建议必须提醒来源记录、检测资料和合法来源证明。`
  },
  {
    file: "concepts/结香.md",
    tags: ["concept", "形成机制"],
    index: "[[结香]] - 沉香树脂形成机制，包括自然感染、创伤和人工诱导。",
    body: `# 结香

结香是沉香价值形成的关键过程：树体受到真菌感染、外部创伤或人工诱导后，产生并积累树脂，形成可用于香料、熏闻或传统用途的芳香木材。

## 要点

- 沉香树本身不等于沉香，未结香的木材不能直接当作高价值香材。
- 自然结香、人工诱导结香和加工处理会影响香气表现、稳定性和价格。
- 结香方式要与树种、来源、实物复闻和检测资料一起判断。

## 导购表达

可以说：沉香不是“木头越老越香”这么简单，而是树在刺激后形成树脂，树脂沉积的位置、时间、香气层次和处理方式共同决定表现。`
  },
  {
    file: "concepts/沉香树种.md",
    tags: ["concept", "植物分类"],
    index: "[[沉香树种]] - 沉香属、拟沉香属及关键物种的分类口径。",
    body: `# 沉香树种

当前 raw 资料的树种主线集中在 [[Aquilaria]]（沉香属）和 [[Gyrinops]]（拟沉香属）。两者都可产生用于香料贸易的 agarwood，但具体物种、分布、保护状态和贸易管制不同。

## 重点实体

- [[Aquilaria sinensis]]：中国语境中的土沉香、白木香，与香港沉香树、传统用途和保护议题关系密切。
- [[Aquilaria malaccensis]]：沉香贸易中的重要树种，常与过度采伐和保护压力关联。
- [[Aquilaria crassna]]：东南亚沉香来源树种之一，资料强调濒危和树脂心材用途。
- [[Gyrinops]]：拟沉香属，与 Aquilaria 一起出现在沉香贸易和 CITES 语境中。

## 使用边界

树种名不能直接等同商品品质。Kew/POWO 适合核对分类，IUCN 适合核对保护状态，CITES 适合核对贸易管制。`
  },
  {
    file: "concepts/产区对比.md",
    tags: ["concept", "产区", "导购"],
    index: "[[产区对比]] - 莞香系、惠安系、星洲系及常见导购边界。",
    body: `# 产区对比

产区对比用于解释风格、树种和贸易口径，不是鉴定或定级证据。回答时要把产区当作线索，而不是把产区名直接等同品质。

## 三类常见口径

- 莞香系/中国系：常见口径包括海南、广东、广西、云南、香港土沉香/白木香，基原多关联 [[Aquilaria sinensis]]。可偏清甜、花蜜、温润和日常闻香表达，但不能说中国系必然等级更高。
- 惠安系：常见口径包括越南、芽庄、柬埔寨、老挝、泰国等，常与 [[Aquilaria crassna]] 等东南亚树种资料关联。适合讲花果、蜜甜、清雅、层次感和线香/香粉/香材场景。
- 星洲系：常见口径包括马来西亚、印尼、达拉干、马泥涝、加里曼丹、文莱等，常与 [[Aquilaria malaccensis]]、小果沉香以及 [[Gyrinops]] 等资料关联。可偏凉感、乳香、木质、穿透力和空间扩散感。

## 风险边界

- 产区只是线索，不是鉴定结论。
- 野生、沉水、奇楠、老料、顶级产区等市场词不能单独作为证据。
- 涉及跨境、野生来源或高价藏品时，应结合 [[CITES]]、[[IUCN]]、来源凭证和检测资料。`
  },
  {
    file: "concepts/香韵解释.md",
    tags: ["concept", "香韵", "选项"],
    index: "[[香韵解释]] - 清甜、凉意、奶韵、药感、木质、花蜜、清雅等香韵选项的中文解释。",
    body: `# 香韵解释

香韵解释用于把用户选择的气味偏好转成可理解的中文表达，而不是把香韵词当成鉴定结论。沉香气味会受树种、产区口径、结香方式、含油状态、加热方式、温度和个人嗅觉经验影响。

## 常见选项

- 清甜：偏干净、轻盈、带自然甜感，适合新手、茶室、书房和日常闻香。
- 凉意：鼻腔或后段有清透感，常用于描述星洲系、部分高油脂香材或较有穿透力的香气，但不能仅凭凉意判断产区。
- 奶韵：柔和、圆润、带乳脂或脂粉感，适合想要温润、不尖锐体验的用户。
- 药感：带草药、苦甘、辛凉或传统药香联想，适合进阶闻香说明；对外表达时不能延伸成医疗功效承诺。
- 木质：干净木气、老木、温木或焚熏后的木香骨架，是沉香解释中的基础维度。
- 花蜜：带花香、蜜甜、果甜联想，适合解释惠安系或清雅型体验，但仍需实物复闻佐证。
- 清雅：强调克制、干净、层次细，不追求强烈冲击，适合静坐、书房、茶席和礼赠语境。

## 回答边界

香韵词只能描述体验，不能直接证明真假、等级、产区或价格。用户问香韵时，应结合[[闻香场景]]、[[熏闻方式]]和[[气味强度]]解释。`
  },
  {
    file: "concepts/闻香场景.md",
    tags: ["concept", "场景", "选项"],
    index: "[[闻香场景]] - 茶室、书房、静坐、助眠、商务空间、送礼、自用、收藏等使用场景。",
    body: `# 闻香场景

闻香场景用于把用户用途转成产品建议和表达方式。场景不是品质证据，而是帮助选择香韵、强度、形态和预算的线索。

## 场景选项

- 茶室：适合清甜、清雅、花蜜、木质等不压茶气的方向；熏闻方式可偏隔火、电熏或低温线香。
- 书房：适合安静、干净、留香不过分扰人的香材、线香或电熏。
- 静坐：适合清雅、木质、轻柔或平衡强度，表达重点放在仪式感和主观安定体验。
- 助眠：只能作为放松场景描述，避免承诺治疗失眠；宜轻柔、低温、少烟。
- 商务空间：适合稳定、干净、有辨识度但不过分浓烈的气味，重视来源记录和稳定供应。
- 送礼：重点是包装、来源说明、接受门槛和风险边界，优先选择解释清楚、形态稳定的产品。
- 自用：可按预算小样试闻，逐步确认香韵偏好。
- 收藏：强调来源记录、检测佐证、保存条件和合规证明，不承诺升值。`
  },
  {
    file: "concepts/熏闻方式.md",
    tags: ["concept", "熏闻", "选项"],
    index: "[[熏闻方式]] - 电熏、隔火、线香、随身闻香的差异和适用边界。",
    body: `# 熏闻方式

熏闻方式会明显影响沉香的气味表现。回答时应先确认用户是想要稳定日用、仪式体验、空间扩香，还是随身轻闻。

## 方式选项

- 电熏：温度可控，适合新手和日常复闻；低温更容易观察清甜、花蜜、奶韵，高温更容易出现木质、药感和烟火感。
- 隔火：仪式感强，适合茶席、静坐和进阶体验；需要控制火候，避免过热焦糊。
- 线香：使用方便，适合空间氛围和礼赠，但配方、粘粉、燃烧状态会影响真实沉香感。
- 随身闻香：常见于手串、香囊、香材小件，适合轻闻和社交距离内体验；要注意汗液、香水和潮湿污染。

## 回答边界

熏闻方式不是等级证明。香材、香粉、线香、手串要分开讲，避免把不同形态混成一个结论。`
  },
  {
    file: "concepts/气味强度.md",
    tags: ["concept", "香韵", "选项"],
    index: "[[气味强度]] - 轻柔、平衡、穿透力强三类强度偏好的导购解释。",
    body: `# 气味强度

气味强度描述用户希望香气在空间和鼻腔中的存在感。它受香材含油、形态、用量、加热温度、空间大小和个人嗅觉阈值共同影响。

## 强度选项

- 轻柔：适合新手、助眠、静坐、书房和近距离闻香；建议少量、低温、短时。
- 平衡：适合多数日常场景，在清甜、木质、花蜜和药感之间保持可接受的存在感。
- 穿透力强：适合较大空间、商务空间或喜欢明确存在感的用户；要提醒可能压过茶气或让新手觉得刺激。

## 回答边界

强度不等于品质，高强度不必然更贵。温度过高可能把细腻香韵烧成焦糊或烟火味。`
  },
  {
    file: "concepts/工艺保养.md",
    tags: ["concept", "保养", "选项"],
    index: "[[工艺保养]] - 香材、线香、香粉、手串和摆件的使用保养边界。",
    body: `# 工艺保养

工艺保养用于回答使用、保存和日常维护问题。沉香相关产品形态不同，保养重点也不同。

## 使用保养

- 香材：避潮、避暴晒、避香水和强气味污染；熏闻时从低温少量开始。
- 香粉：注意密封、防潮和洁净取用；不建议混入来源不明粉末。
- 线香：保持干燥，观察燃烧是否稳定；少烟、无刺鼻异味更适合日用。
- 手串：避免水洗、汗液长期浸润、香水和化学清洁剂；盘玩以干净手部和自然佩戴为主。
- 摆件和收藏藏品：重视湿度、温度、避光、虫霉风险和来源记录保存。

## 回答边界

保养不能替代真假鉴别。不建议用破坏性方法测试，如火烧、泡水、刮削高价藏品。`
  },
  {
    file: "concepts/产品形态.md",
    tags: ["concept", "产品", "选项"],
    index: "[[产品形态]] - 香材、手串、香粉、线香、摆件、收藏藏品的选择逻辑。",
    body: `# 产品形态

产品形态决定用户该如何闻、如何保存、如何判断风险。回答导购问题时，应先区分用户选择的是香材、手串、香粉、线香、摆件还是收藏藏品。

## 形态选项

- 香材：适合复闻和进阶体验，重点看香韵、结香状态、来源记录和熏闻表现。
- 手串：适合佩戴和随身闻香，重点看材质、工艺、油脂表现、佩戴习惯和保养。
- 香粉：适合电熏、隔火或制作场景，重点看来源、纯度、气味干净度和混粉风险。
- 线香：适合日用和送礼，重点看配方、燃烧状态、烟感和稳定供应。
- 摆件：适合展示和空间叙事，重点看完整性、工艺、气味真实性和保存条件。
- 收藏藏品：重点看来源记录、检测佐证、合法来源证明和长期保存，不承诺投资收益。`
  },
  {
    file: "concepts/预算层级.md",
    tags: ["concept", "预算", "选项"],
    index: "[[预算层级]] - 500 入门、3000 进阶、20000 高阶、收藏级的购买建议边界。",
    body: `# 预算层级

预算层级用于把用户价格预期转成风险可控的购买路径。预算不是品质结论，尤其不能把高价直接等同于真货或更适合。

## 预算选项

- 500 入门试香：优先小样、线香、香粉或低风险香材体验，目标是建立香韵偏好。
- 3000 进阶预算：可尝试更稳定的香材、手串或组合装，重点看复闻表现和来源说明。
- 20000 高阶预算：需要更完整的来源记录、检测佐证、商家信誉和复闻确认。
- 收藏级：必须强调合法来源证明、保存条件、检测资料和风险边界，不承诺升值。

## 回答边界

不承诺投资回报。不用单一产区、沉水、野生、奇楠等词直接证明价格合理。`
  },
  {
    file: "concepts/购买偏好.md",
    tags: ["concept", "导购", "选项"],
    index: "[[购买偏好]] - 新手稳妥、小幅升级、重视稀缺性的导购口径。",
    body: `# 购买偏好

购买偏好用于控制推荐的风险程度，而不是直接推荐某个最高价商品。

## 偏好选项

- 新手稳妥：优先小规格、可复闻、解释清楚、来源记录完整的产品，避免高价故事型商品。
- 愿意小幅升级：在已有香韵偏好上提高预算，比较不同形态和强度，不急于收藏级。
- 重视稀缺性：可以讨论产区、树种、结香和收藏属性，但必须同时提醒来源记录、检测佐证、合法来源证明和保存风险。`
  },
  {
    file: "concepts/价格等级.md",
    tags: ["concept", "价格", "选项"],
    index: "[[价格等级]] - 沉香价格受形态、香韵、来源、结香、检测和合规资料共同影响。",
    body: `# 价格等级

价格等级用于解释为什么沉香价格差异大，以及购买时应看哪些证据。高价伴随更高的真假、来源和合规风险。

## 影响因素

- 产品形态：香材、手串、香粉、线香、摆件、收藏藏品的定价逻辑不同。
- 香韵表现：清甜、凉意、奶韵、药感、木质、花蜜、清雅等只能描述体验，不能单独定级。
- 来源记录：产区、树种、商家记录、合法来源证明会影响可信度。
- 结香状态：油脂分布、香气层次、熏闻稳定性和处理方式都重要。
- 检测佐证：高价或对外宣传场景应结合检测资料和可追溯文件。

## 风险表达

沉水、野生、奇楠、老料、顶级产区等词不能单独证明价格。收藏级不等于投资品，不能承诺升值。`
  },
  {
    file: "concepts/真假鉴别.md",
    tags: ["concept", "鉴别", "选项"],
    index: "[[真假鉴别]] - 真伪、来源、检测、复闻和高风险宣传词的判断框架。",
    body: `# 真假鉴别

真假鉴别是用户购买沉香时的高风险主题。知识库应给出判断框架，而不是隔空下鉴定结论。

## 判断框架

- 看来源：商家记录、产区口径、合法来源证明、交易票据和可追溯资料。
- 看实物：颜色、油脂、纹理、重量、气味变化和熏闻表现要综合判断。
- 看检测：高价购买、收藏或对外宣传时，应要求检测佐证。
- 看表达：警惕绝对化词汇，例如包真、顶级、稳赚、必升值、绝对野生。
- 看场景：香材、手串、香粉、线香的鉴别重点不同，不能用一个标准套所有形态。

## 回答边界

不能仅凭图片、产区名、沉水或香韵词给出最终真伪结论。可建议用户补充实物复闻、来源记录、检测资料和合法来源证明。`
  },
  {
    file: "concepts/CITES.md",
    tags: ["concept", "合规"],
    index: "[[CITES]] - 沉香相关物种跨境贸易和附录管理的核心合规入口。",
    body: `# CITES

CITES 是濒危野生动植物种国际贸易公约。沉香相关的 [[Aquilaria]] 和 [[Gyrinops]] 材料涉及国际贸易、持有、进出口和证明文件时，应优先核对 CITES 附录、物种清单和当地法规。

## 回答边界

- 可以提醒用户关注合法来源证明、进出口许可和购买记录。
- 不给确定法律意见；涉及交易、跨境运输或商业库存时，需要查最新官方规则。
- CITES 信息可能更新，生产和跨境导购场景必须以最新官方资料为准。`
  },
  {
    file: "concepts/濒危保护.md",
    tags: ["concept", "保护"],
    index: "[[濒危保护]] - 沉香相关树种的资源压力、保护状态和非法采伐风险。",
    body: `# 濒危保护

沉香相关树种因高价值香材贸易、野外过度砍伐和栖息地压力而面临保护风险。IUCN、CITES、Kew 和香港报道都为这一主题提供证据入口。

## 要点

- 多种 Aquilaria 资料涉及威胁或保护状态。
- 香港报道强调本地沉香树因非法砍伐而接近灭绝。
- 保护状态不是静态信息，应定期核对最新 IUCN、CITES 和地方制度。`
  },
  {
    file: "concepts/沉香贸易.md",
    tags: ["concept", "贸易"],
    index: "[[沉香贸易]] - 沉香使用史、经济价值、国际贸易和风险表达。",
    body: `# 沉香贸易

沉香因香料、宗教、传统用途和奢侈消费而具有长期贸易史。高价值贸易也带来过度采伐、非法流通和保护压力。

## 要点

- 贸易价值来自稀缺性、香气文化和树脂木材的特殊用途。
- 种植和人工诱导结香可成为可持续供应方向，但不能承诺高额投资回报。
- 对外宣传应同时说明合规来源、保护边界和购买风险。`
  },
  {
    file: "concepts/鉴别风险.md",
    tags: ["concept", "风险"],
    index: "[[鉴别风险]] - 真伪、品质、产区、投资和药用宣传中的风险边界。",
    body: `# 鉴别风险

沉香判断风险来自多处：树种和产地不能直接证明品质，沉香树不结香就没有高价值香材意义，投资种植存在骗局风险，药用和功效表达需要合规边界。

## 稳妥判断

- 看树种、来源、结香方式、实物复闻、检测资料和合法来源证明。
- 不把野生、沉水、顶级产区、奇楠等词当成单独证据。
- 英文来源中的保护、分类和法规内容要翻译成中文解释，并提示时效性。`
  },
  {
    file: "concepts/合规表达.md",
    tags: ["concept", "合规"],
    index: "[[合规表达]] - 面向用户、导购和文案时的中文表达边界。",
    body: `# 合规表达

沉香可介绍传统使用、香气体验、空间审美和文化价值；但面向消费者时，不应承诺医疗疗效、治疗效果、投资收益或绝对鉴定结论。

## 可以表达

- 适合闻香、茶席、书房、展陈、文化讲解。
- 与传统香料、药用文献、贸易历史相关。
- 购买时建议关注可追溯来源、合法证明、检测资料和实物复闻。

## 避免表达

- 治病、包治、抗癌、降血压、治疗焦虑失眠。
- 包升值、稳赚、绝对野生、绝对顶级。
- 未核实的法律结论或跨境交易建议。`
  },
  {
    file: "concepts/资料边界.md",
    tags: ["concept", "工作规范"],
    index: "[[资料边界]] - 处理英文来源、重复来源和非沉香资料时的使用规则。",
    body: `# 资料边界

知识库应区分主源、辅助源和外围参考。raw 是原始资料，wiki 是面向 RAG 的中文整理层，回答时优先使用 wiki。

## 使用规则

- 主源：沉香属、拟沉香属、沉香、CITES、IUCN、Kew、香港沉香树、使用与贸易史。
- 辅助源：地方行政区资料、重复百科条目和宽泛检索结果。
- 英文原文只做证据来源，回答必须中文化。
- 不把 raw 原文片段直接拼进答案；应先整理成概念页、实体页或来源摘要页。`
  },
  {
    file: "concepts/人工种植沉香.md",
    tags: ["concept", "来源"],
    index: "[[人工种植沉香]] - 以栽培和人工诱导结香为核心的可持续供应口径。",
    body: `# 人工种植沉香

人工种植沉香指通过栽培沉香相关树种，并通过自然管理或人工诱导方式形成树脂木材的供应路径。

## 要点

- 种植不等于低品质，野生也不等于必然更好。
- 品质仍取决于树种、树龄、诱导方式、树脂沉积、加工和复闻表现。
- 导购可强调可追溯、合规、稳定供应，但不能承诺投资回报。`
  },
  {
    file: "concepts/野生沉香.md",
    tags: ["concept", "来源"],
    index: "[[野生沉香]] - 稀缺性、非法采伐和合规风险并存的来源口径。",
    body: `# 野生沉香

野生沉香常被市场赋予稀缺性和故事性，但知识库资料更强调其背后的非法采伐、资源枯竭和保护压力。

## 要点

- 不应把野生直接等同于高品质或高价值。
- 高价值野生材料需要来源记录、合法证明、检测资料和实物复闻。
- 对外表达应避免浪漫化非法采伐或濒危资源消耗。`
  },
  {
    file: "concepts/沉香使用史.md",
    tags: ["concept", "历史"],
    index: "[[沉香使用史]] - 沉香在香料、宗教、传统药用和贸易中的历史使用脉络。",
    body: `# 沉香使用史

沉香长期用于香料、宗教仪式、传统药用和高价值贸易。使用与贸易史可作为文化讲解和展陈叙事来源，但不能替代现代法规、药品监管或交易合规判断。

## 使用方式

- 可解释沉香为什么在东亚、东南亚和国际贸易中具有高价值。
- 可用于品牌文化、文博展陈和香文化普及。
- 不应据此承诺疗效、升值或绝对品质。`
  },
  {
    file: "concepts/闻香体验.md",
    tags: ["concept", "感知"],
    index: "[[闻香体验]] - 处理闻香主观感受、感知研究和英文外围资料的入口。",
    body: `# 闻香体验

闻香体验关注用户如何描述香气、空间氛围和身体感受。它可以帮助解释主观差异，但不能把心理或感知研究转写成沉香疗效承诺。

## 使用边界

- 可用于解释香气体验为什么具有主观性和场景差异。
- 不应把放松、静心、助眠等体验说成治疗结果。
- 英文外围资料如被引用，必须转述为中文并标明只是外围参考。`
  }
];

const entityDefinitions = [
  ["entities/Aquilaria.md", ["entity", "属"], "[[Aquilaria]] - 沉香属，沉香主要来源类群之一。", `# Aquilaria

Aquilaria 即沉香属，是瑞香科中的一类树木，也是沉香最重要的植物来源之一。

## 要点

- 常见中文口径包括沉香属、白木香、土沉香等具体物种或地方名称。
- Kew/POWO 适合核对接受名与异名。
- 过度采伐和沉香贸易使多种 Aquilaria 面临保护压力。`],
  ["entities/Gyrinops.md", ["entity", "属"], "[[Gyrinops]] - 拟沉香属，沉香来源类群之一。", `# Gyrinops

Gyrinops 即拟沉香属，与 [[Aquilaria]] 同属沉香贸易和香料生产中需要关注的植物类群。

## 要点

- Gyrinops 可产生 agarwood，常在 CITES 和沉香贸易语境中与 Aquilaria 并列讨论。
- 具体商品品质仍需结合物种、来源、结香和实物复闻判断。`],
  ["entities/Aquilaria sinensis.md", ["entity", "物种"], "[[Aquilaria sinensis]] - 土沉香/白木香，中国与香港语境中的关键树种。", `# Aquilaria sinensis

Aquilaria sinensis 是中文语境中常见的土沉香、白木香相关物种。资料涉及香港、本地树种、传统用途、树脂采集、保护和 CITES 管理。

## 要点

- 可用于解释中国本土沉香、土沉香、白木香和香港沉香树。
- 传统用途不能直接转写为现代医疗功效承诺。
- 保护和采伐问题需要结合 CITES 与地方规则。`],
  ["entities/Aquilaria malaccensis.md", ["entity", "物种"], "[[Aquilaria malaccensis]] - 沉香贸易中的重要树种，保护压力显著。", `# Aquilaria malaccensis

Aquilaria malaccensis 是沉香贸易中非常重要的树种，资料强调其 agarwood 用途、威胁和保护议题。

## 要点

- 与香料、熏香和沉香贸易密切相关。
- 过度采伐和野外资源压力是核心风险。
- 商品品质仍需看实物、来源、结香和处理方式。`],
  ["entities/Aquilaria crassna.md", ["entity", "物种"], "[[Aquilaria crassna]] - 东南亚沉香来源物种，资料强调濒危和树脂形成。", `# Aquilaria crassna

Aquilaria crassna 是东南亚沉香来源物种之一。资料提到其濒危状态，并说明它可产生用于香水和熏香的树脂心材。

## 要点

- 结香可与感染或外部刺激有关。
- 应与产地、结香方式、保护状态和贸易合规一起理解。`],
  ["entities/土沉香.md", ["entity", "中文名"], "[[土沉香]] - A. sinensis 的中文常用口径，连接白木香、香港沉香树和保护议题。", `# 土沉香

土沉香是中文资料中与 [[Aquilaria sinensis]] 紧密相关的名称，也常与白木香、香港沉香树和传统用途相连。

## 要点

- 可作为解释中国本土沉香树种的入口。
- 使用时应区分树种、香材、药材和商品名。`],
  ["entities/香港沉香树.md", ["entity", "地区"], "[[香港沉香树]] - 与 A. sinensis、非法采伐和本地保护相关的文化生态实体。", `# 香港沉香树

香港沉香树主要连接 [[Aquilaria sinensis]]、本地历史文化、非法砍伐和濒危保护议题。

## 要点

- 可用于讲解沉香与香港地名、香料贸易和生态保护的关系。
- 不适合包装成“野生更好”的销售故事，应转向合法来源和保护意识。`],
  ["entities/Kew POWO.md", ["entity", "资料源"], "[[Kew POWO]] - 核对 Aquilaria/Gyrinops 分类、异名和接受名的植物学来源。", `# Kew POWO

Kew Plants of the World Online 是核对植物分类、接受名、异名和分布信息的重要来源。

## 使用方式

- 用于核对树种名称和异名，不直接判断商品价值。
- 与 CITES、IUCN 配合使用，可区分分类事实、保护状态和贸易管制。`],
  ["entities/IUCN.md", ["entity", "资料源"], "[[IUCN]] - 核对沉香相关物种保护状态的来源。", `# IUCN

IUCN 红色名录用于核对物种受威胁等级和保护状态。

## 使用方式

- 回答保护状态时，应说明信息可能更新，必要时核对最新 IUCN 页面。
- IUCN 保护状态不等于 CITES 贸易管制，两者需要分开解释。`],
  ["entities/沉香属.md", ["entity", "属", "别名"], "[[沉香属]] - Aquilaria 的中文别名页，指向沉香属分类和物种资料。", `# 沉香属

沉香属是 [[Aquilaria]] 的中文名称。本页作为别名页，主要指向 [[Aquilaria]]、[[沉香树种]] 与具体物种页面。`]
];

function yamlValue(value) {
  return JSON.stringify(value);
}

function frontmatter(tags, sources = [], extra = {}) {
  const lines = ["---", "tags:", ...tags.map((tag) => `  - ${yamlValue(tag)}`), `date: ${today}`];
  for (const [key, value] of Object.entries(extra)) {
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  if (sources.length > 0) {
    lines.push("sources:");
    lines.push(...sources.map((source) => `  - ${yamlValue(source)}`));
  } else {
    lines.push("sources: []");
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n`;
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

function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function extractFrontmatterTitle(content) {
  const match = content.match(/^---\n[\s\S]*?\ntitle:\s*["']?(.+?)["']?\s*\n[\s\S]*?\n---\n/);
  return match?.[1]?.trim();
}

function extractFirstHeading(content) {
  const match = stripFrontmatter(content).match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function cleanText(content) {
  return stripFrontmatter(content)
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\[\^[^\]]+]:.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(content, length = 700) {
  return cleanText(content).slice(0, length).trimEnd();
}

function linkList(items) {
  return items.map((item) => `[[${item}]]`).join("、");
}

function ensureTrailingNewline(content) {
  return content.endsWith("\n") ? content : `${content}\n`;
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
  await writeFile(fullPath, ensureTrailingNewline(content), "utf8");
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
      frontmatter(["source"], [rawFile], { source_type: "raw-summary" }) +
      `# ${title}

${summary}

## 资料边界

- 原始文件：\`${rawFile}\`
- 该页是来源摘要，不替代原文。
- 若源文件为英文，AI Agent 必须用中文解释、转述和回答。
- 涉及保护等级、贸易规则、药用或法律问题时，应回到原文和最新官方资料核对。

## 关键关联

${linkList(links)}

## 原文摘录

> ${excerpt(content)}
`
  };
}

function relatedLinksFor(pageFile) {
  if (pageFile.includes("香韵")) return ["闻香场景", "熏闻方式", "气味强度", "真假鉴别"];
  if (pageFile.includes("产区")) return ["沉香树种", "Aquilaria sinensis", "Aquilaria malaccensis", "Gyrinops", "真假鉴别"];
  if (pageFile.includes("价格") || pageFile.includes("预算") || pageFile.includes("购买")) return ["产品形态", "真假鉴别", "合规表达", "沉香贸易"];
  if (pageFile.includes("真假") || pageFile.includes("鉴别")) return ["鉴别风险", "价格等级", "产品形态", "合规表达"];
  if (pageFile.includes("CITES") || pageFile.includes("合规")) return ["濒危保护", "沉香贸易", "Aquilaria", "Gyrinops"];
  return ["沉香", "沉香树种", "资料边界"];
}

function conceptPages(rawFiles) {
  return conceptDefinitions.map((page) => ({
    ...page,
    content:
      frontmatter(page.tags, rawFiles, { page_type: "concept" }) +
      `${page.body}

## 相关

${linkList(relatedLinksFor(page.file))}
`
  }));
}

function entityPages(rawFiles) {
  return entityDefinitions.map(([file, tags, index, body]) => ({
    file,
    tags,
    index,
    content:
      frontmatter(tags, rawFiles, { page_type: "entity" }) +
      `${body}

## 相关

${linkList(["沉香树种", "CITES", "濒危保护", "资料边界"])}
`
  }));
}

const mojibakeCodePoints = [
  0xfffd,
  0x93b4,
  0x942d,
  0x68e3,
  0x6b13,
  0x5a0c,
  0x951b,
  0x9286
];

const mojibakeTokens = mojibakeCodePoints.map((codePoint) => String.fromCodePoint(codePoint));

async function listMarkdownFiles(dir, baseDir = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath, baseDir)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}

async function assertNoMojibakeInWiki() {
  const files = await listMarkdownFiles(wikiRoot);
  const hits = [];

  for (const file of files) {
    const fullPath = path.join(wikiRoot, file);
    const content = await readFile(fullPath, "utf8");
    for (const token of mojibakeTokens) {
      const index = content.indexOf(token);
      if (index >= 0) {
        hits.push({
          file,
          codePoint: `U+${token.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
          offset: index
        });
      }
    }
  }

  if (hits.length > 0) {
    throw new Error(`wiki mojibake quality gate failed:\n${hits.map((hit) => `${hit.file} ${hit.codePoint} offset=${hit.offset}`).join("\n")}`);
  }
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
    frontmatter(["index"], [], { page_type: "index" }) +
    `# Index

## Sources

${sourcePages.map((page) => `- [[${page.wikiName}]] - ${page.summary}`).join("\n")}

## Concepts

${concepts.map((page) => `- ${page.index}`).join("\n")}

## Entities

${entities.map((page) => `- ${page.index}`).join("\n")}

## Knowledge Base Rules

- raw 原文只存放在 \`knowledge/raw/\`。
- \`knowledge/wiki/\` 只放面向 RAG 的中文整理页。
- AI Agent 应优先引用 wiki 概念页、实体页和来源摘要页，不直接拼接 raw 片段。
- 缺资料时明确说知识库未命中，并指出需要补充哪类资料。

## Outputs
`;

  const log =
    frontmatter(["log"], [], { page_type: "log" }) +
    `# Log

## [${today}] ingest | 重建 LLM Wiki

- 扫描 \`knowledge/raw/\` 当前 ${rawFiles.length} 个 Markdown 源文件。
- 为每个源文件重建 \`wiki/sources/\` 摘要页。
- 重建 ${concepts.length} 个概念页和 ${entities.length} 个实体页。
- 约定：即使源文件为英文，RAG 和 AI Agent 也必须使用中文回答。
- 约定：选项类问题依靠 wiki 页召回，不在聊天接口里硬编码答案。
`;

  await writeManagedPage("index.md", index);
  await writeManagedPage("log.md", log);
  await assertNoMojibakeInWiki();

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
