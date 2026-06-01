# Agarwood AI

面向沉香品牌、文博馆和私域导购的中文 AI 助手。应用包含闻香导师、沉香百科、导购 Agent 和后台知识库/商品管理。

## 当前架构

- Next.js 14 App Router
- PostgreSQL + pgvector
- 国内模型 API，可切换 DeepSeek / 混元 / Kimi / 通义等供应商
- Nginx 反向代理到 `https://mlangtse.top/agarwood`
- 普通 `next build` + `next start`，不使用 standalone 输出

## 目录

```text
app/                  Next.js 页面与 API
components/           前端组件
lib/db.ts             PostgreSQL 连接池
lib/model-api.ts      国内模型 API 适配层
lib/rag.ts            知识库切片、embedding、检索
lib/products.ts       商品库读写与导入
db/schema.sql         PostgreSQL/pgvector 表结构
scripts/deploy-tencent.sh
deploy/               部署脚本生成的 Nginx 配置
```

## 环境变量

复制模板：

```bash
cp .env.example .env.local
```

生产环境建议使用 `.env.production`：

```bash
cp .env.example .env.production
```

关键变量：

```bash
NEXT_PUBLIC_BASE_PATH=/agarwood

DATABASE_URL=postgresql://agarwood:password@127.0.0.1:5432/agarwood_ai
POSTGRES_SSL=false

MODEL_API_BASE_URL=https://api.deepseek.com/v1
MODEL_API_KEY=your-api-key
MODEL_CHAT_MODEL=deepseek-chat
MODEL_EMBEDDING_MODEL=text-embedding-v1
MODEL_EMBEDDING_DIMENSIONS=1536
```

模型接口只要求提供 `/chat/completions` 与可选 `/embeddings` 兼容路由。要切到混元、Kimi、通义千问或其他国内服务，改 `MODEL_API_BASE_URL`、`MODEL_API_KEY`、`MODEL_CHAT_MODEL` 即可。若当前供应商没有 embedding 接口，可以设置：

```bash
MODEL_EMBEDDING_DISABLED=true
```

应用会使用本地 deterministic embedding，知识库仍能运行，只是语义检索质量会弱一些。

## 本地运行

```bash
npm install
npm run dev
```

默认 basePath 是 `/agarwood`，本地访问：

```text
http://127.0.0.1:3000/agarwood
http://127.0.0.1:3000/agarwood/chat
http://127.0.0.1:3000/agarwood/admin
```

未配置 PostgreSQL 时，商品和知识库会落到 `data/*.json`，方便本地预览。

## 初始化 PostgreSQL

数据库需要启用 `pgvector`。腾讯云 PostgreSQL 若不支持该扩展，可使用自建 PostgreSQL 或支持 pgvector 的托管实例。

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
```

`db/schema.sql` 会创建商品、产区、知识库、embedding、推荐收藏等表，并写入基础产区数据。

## 腾讯云一键部署

服务器准备：

```bash
sudo apt update
sudo apt install -y nodejs npm nginx postgresql-client
sudo npm install -g pm2
```

把代码放到服务器后，在项目根目录创建 `.env.production`，填入真实的 `DATABASE_URL` 和模型 API key。

运行：

```bash
scripts/deploy-tencent.sh
```

脚本会：

- `npm ci`
- 用 `db/schema.sql` 初始化/更新 PostgreSQL
- `npm run build`
- 生成 `deploy/nginx-agarwood.conf`
- 使用 pm2 启动或重载 `agarwood-ai`

将 Nginx 配置启用：

```bash
sudo cp deploy/nginx-agarwood.conf /etc/nginx/conf.d/agarwood.conf
sudo nginx -t
sudo systemctl reload nginx
```

访问：

```text
https://mlangtse.top/agarwood
https://mlangtse.top/agarwood/api/health
```

## Nginx 反向代理

脚本生成的核心配置如下：

```nginx
location /agarwood/ {
  proxy_pass http://127.0.0.1:3000/agarwood/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_buffering off;
}
```

前端 API 请求已经统一走 `NEXT_PUBLIC_BASE_PATH + /api/...`，因此在 `/agarwood` 子路径下不会请求到错误的 `/chat/api/...`。

## 常用命令

```bash
npm run typecheck
npm run build
npm run start
scripts/deploy-tencent.sh --local --skip-migrate
```

## 生产检查

部署后建议检查：

```bash
curl -I https://mlangtse.top/agarwood
curl https://mlangtse.top/agarwood/api/health
pm2 logs agarwood-ai
```

如果 `/api/health` 正常但 AI 无响应，优先检查 `MODEL_API_BASE_URL`、`MODEL_API_KEY` 和云服务器到模型服务的网络连通性。如果知识库上传失败，优先检查 PostgreSQL 是否启用 `vector` 扩展，以及 `MODEL_EMBEDDING_DIMENSIONS` 是否与 `db/schema.sql` 中的 `vector(1536)` 一致。
