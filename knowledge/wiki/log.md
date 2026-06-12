---
tags:
  - "log"
date: 2026-06-12
page_type: "log"
sources: []
---

# Log

## [2026-06-12] ingest | 重建 LLM Wiki

- 扫描 `knowledge/raw/` 当前 26 个 Markdown 源文件。
- 重建 28 个概念页和 10 个实体页。
- 约定：即使源文件为英文，RAG 和 AI Agent 也必须使用中文回答。
- 约定：选项类问题依靠 wiki 页召回，不在聊天接口里硬编码答案。
