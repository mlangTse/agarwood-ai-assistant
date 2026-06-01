# 沉香 AI 助手 MVP

面向沉香文博馆 / 高端沉香品牌的 AI 导览、知识问答和导购转化 Web 应用。包含三个核心模块：

- AI 闻香导师：根据偏好和场景推荐产区、熏香方式、温度、搭配和理由。
- AI 沉香百科：Markdown / TXT / PDF 知识库上传，自动切片、Embedding、向量检索、基于 RAG 回答。
- AI 导购 Agent：按预算、用途、偏好推荐香材、手串、香粉、线香、摆件和收藏级产品。

## 技术栈

- Next.js + TypeScript
- TailwindCSS
- shadcn/ui 风格本地组件
- Supabase / PostgreSQL / pgvector
- OpenAI Chat + Embeddings
- Docker / 腾讯云部署

## 目录结构

```txt
app/
  api/
    chat/route.ts
    knowledge/upload/route.ts
    preferences/route.ts
    products/route.ts
    recommendations/favorite/route.ts
    regions/route.ts
  admin/page.tsx
  chat/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  admin-client.tsx
  chat-client.tsx
  nav.tsx
  ui/
lib/
  openai.ts
  rag.ts
  recommendation.ts
  sample-data.ts
  types.ts
  prompts/agents.ts
  supabase/server.ts
supabase/
  schema.sql
```

## 部署和启动

项目要求 Node.js `>=20.9.0`。本地一键启动：

```bash
npm run setup:start
```

首次运行前确保 Docker Desktop 已启动，并安装 Supabase CLI：

```bash
brew install supabase/tap/supabase
```

脚本会自动安装依赖、启动本地 Supabase、执行 `supabase/schema.sql`、写入 `.env.local`，并启动 `http://127.0.0.1:3000`。如果本机没有 Docker / Supabase CLI，会自动切到本地模拟模式，仍然可以直接打开页面。

```bash
npm run verify:start                        # 启动页面、上传示例知识库并调用聊天接口
scripts/local-supabase-flow.sh --no-dev     # 只准备环境，不启动页面
scripts/local-supabase-flow.sh --local-only # 强制使用本地模拟模式
scripts/local-supabase-flow.sh --reset-db   # 重建本地数据库，会清空本地 Supabase 数据
```

如果只想用本地模拟模式，不接 Supabase / OpenAI：

```bash
npm install
cp .env.example .env.local
npm run dev
```

未配置 OpenAI / Supabase 时，应用会使用本地流式模拟、内置商品和产区样例；知识库上传会保存到 `data/knowledge-documents.json`。

生产部署使用同一套环境变量。先准备数据库：

1. 在 Supabase 或 PostgreSQL 中执行 `supabase/schema.sql`。
2. 确认已启用 `pgvector` / `vector` 扩展。
3. 将 `.env.example` 中的 OpenAI 和 Supabase 配置写入服务器环境变量。

然后构建并启动：

```bash
npm install
npm run build
npm run start
```

### 腾讯云部署

推荐用腾讯云轻量应用服务器或 CVM 运行 Docker 镜像，域名 `mlangtse.top` 通过 DNS 指向服务器公网 IP，再用 Nginx / 宝塔 / 腾讯云 EdgeOne 做 HTTPS 反向代理。

#### 1. 推送到 GitHub

确认 `.env.local` 不会被提交，`.env.example` 只保留示例值：

```bash
git status --short
git add .
git commit -m "Initial Agarwood AI app"
git remote add origin git@github.com:<your-name>/<your-repo>.git
git push -u origin main
```

#### 2. 准备腾讯云服务器

服务器建议：

- 系统：Ubuntu 22.04 LTS
- 规格：1 核 2G 可运行 MVP，生产建议 2 核 4G 起
- 安全组：开放 `80`、`443`，临时调试可开放 `3000`

安装 Docker：

```bash
curl -fsSL https://get.docker.com | bash
systemctl enable --now docker
```

#### 3. 配置生产环境变量

在服务器项目目录创建 `.env.production`，不要提交到 GitHub：

```env
NEXT_PUBLIC_SUPABASE_URL=https://qqyisexdvlefnzwwtkrt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI 先可留空，应用会使用本地兜底回答；后续可替换为兼容 OpenAI SDK 的国内模型接入层。
OPENAI_API_KEY=
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

注意：`SUPABASE_SERVICE_ROLE_KEY` 是服务器密钥，只能放在服务器环境变量或 `.env.local` / `.env.production`，不要写入 `.env.example` 或 GitHub。

#### 4. 构建并启动容器

```bash
git clone git@github.com:<your-name>/<your-repo>.git
cd <your-repo>
docker build -t agarwood-ai-assistant .
docker run -d \
  --name agarwood-ai-assistant \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  agarwood-ai-assistant
```

健康检查：

```bash
curl http://127.0.0.1:3000/api/health
```

#### 5. 绑定 `mlangtse.top`

在域名 DNS 解析中添加：

```txt
主机记录  类型  记录值
@        A     你的腾讯云服务器公网 IP
www      A     你的腾讯云服务器公网 IP
```

如果使用腾讯云 EdgeOne / CDN，则按产品给出的 CNAME 值配置 `@` 或 `www` 的 CNAME。

Nginx 反向代理示例：

```nginx
server {
  listen 80;
  server_name mlangtse.top www.mlangtse.top;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

配置 HTTPS 后访问：

```txt
https://mlangtse.top
https://mlangtse.top/api/health
```

Vercel 部署时也可以导入 GitHub 仓库，填入同样的环境变量即可。

## 推荐算法

香韵评分维度：

- 甜感、凉感、奶韵、药感、木质感、穿透力、留香、新手友好度、收藏价值

实现位置：`lib/recommendation.ts`

算法先从用户输入中识别预算、场景和香韵标签，再合成目标香韵 profile。产品按香韵距离、场景命中、标签命中排序，并生成风险点、新手建议与预算升级建议。

## 商品录入和批量导入

后台 `/admin` 的“商品录入”支持两种方式：

- 单个录入：填写商品名称、产区、价格、产品类型、香韵标签和香韵评分后保存。
- 批量导入：上传 `.xlsx`、`.xls`、`.csv`、`.tsv`、`.md`、`.txt` 文件。

未配置 Supabase 时，商品会写入 `data/products.json`，重启开发服务器后仍保留；配置 Supabase 后写入 `products` 表。导购 Agent 会读取同一份商品库，不再只使用内置样例商品。

批量导入推荐字段：

```txt
商品名称 / name
产品类型 / type
产区 / region
零售价 / priceYuan
预算层级 / budgetLevel
香韵/场景标签 / scentTags
适合场景 / suitableFor
风险提示 / riskNotes
产品介绍 / description
甜感、凉感、奶韵、药感、木质感、穿透力、留香、新手友好度、收藏价值
```

Markdown / TXT 支持两种结构：

```md
### 奇楠方条香（SP00237）

- 产品类型：线香
- 产区：海南
- 零售价：98 元
- 预算层级：500 元级 / 入门体验
- 香韵/场景标签：奇楠、凉韵、助眠静心、线香
- 产品介绍：独立瓶装设计每瓶净重10克。
```

或 Markdown 表格。重复商品按“商品名称 + 产区 + 产品类型”跳过。

## Agent Prompt

实现位置：`lib/prompts/agents.ts`

统一语气约束：

- 像专业香道老师，克制、笃定、有边界。
- 不使用普通客服话术。
- 不夸张承诺功效。
- 真伪、等级、产区、价格必须提示实物复闻、来源记录和检测佐证。

## API Routes

- `POST /api/chat`：三模块统一聊天入口，支持 SSE 流式输出。
- `POST /api/knowledge/upload`：知识库上传、切片、Embedding。
- `GET /api/knowledge/documents`：知识库文件记录。
- `GET /api/products`：商品列表。
- `POST /api/products`：商品录入。
- `POST /api/products/import`：Excel / Markdown / TXT 商品批量导入。
- `GET /api/regions`：产区资料。
- `POST /api/preferences`：从文本推断用户偏好。
- `POST /api/recommendations/favorite`：收藏推荐。

## 页面

- `/`：品牌首页，Hero 文案与三个入口卡片。
- `/chat`：偏好选择式对话页，支持模块切换、流式输出、香韵标签、推荐卡片和知识来源展示。
- `/admin`：后台管理，支持商品录入、香韵评分编辑、知识库上传、产区资料查看。

## Vercel 部署

1. 将项目推送到 GitHub。
2. Vercel 导入仓库。
3. 配置环境变量：见 `.env.example`。
4. Supabase 执行 `supabase/schema.sql`。
5. 部署后访问首页，先在后台上传知识文件，再测试百科问答。

## 扩展方向

- 微信小程序：复用 `/api/chat`、`/api/products`、`/api/preferences`。
- AR 文博馆：新增展品表与空间点位表，RAG 中加入展陈讲解资料。
- 数字人讲解：将 Agent 输出接 TTS / 数字人驱动接口。
- 区块链溯源：为 `products` 增加 `traceability_hash`、`certificate_url`、`chain_tx_id` 字段。
