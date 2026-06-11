---
tags:
  - "log"
date: 2026-06-11
sources: []
---

# Log

## [2026-06-11] ingest | 重新摄入当前 raw 资料

- 扫描 `knowledge/raw/` 当前 18 个 Markdown 源文件。
- 为每个源文件重建 `wiki/sources/` 摘要页。
- 重建沉香物种、CITES、IUCN、Kew、保护、贸易、合规和资料边界等核心页面。
- 约定：即使源文件为英文，RAG 和 AI Agent 也必须使用中文回答。
