# Lumen · 微光

A little light, just when you need it.

# 项目概述

Traditional reading is a purely cognitive process that often leads to
information overload when dealing with complex novel plots or dense academic
arguments. This project explores the "Augmented Reading" paradigm by utilizing
Large Language Models (LLMs) to generate real-time visualizations from text.
As a user reads, the system dynamically creates character networks for fiction
and logical flowcharts for academic papers. We aim to investigate whether this
immediate visual feedback can significantly improve comprehension and create a
more engaging reading experience. By comparing two distinct genres, narrative
fiction and argumentative literature, this research will provide critical
insights into how AI-driven visual metaphors should adapt to different
information structures. The outcome will be a prototype system and a study on
how generative AI can transform passive reading into an intuitive, multi-modal
journey.

# 技术栈

| 层次 | 技术 |
| --- | --- |
| 前端框架 | React |
| 开发语言 | TypeScript |
| 构建工具 | Vite |
| AI 接口 | DeepSeek API |
| 数据格式 | JSON |

# 实验日志

进入每本图书前会要求填写参与者 ID。完成阅读后，文末的结束按钮会生成一条结构化 JSON，包含活跃阅读时长、自然经过时长、阅读进度，以及 Low/Medium 辅助调用统计与时间序列事件。

本地运行 FastAPI 时，日志位于 `backend/data/experiment-logs/<sessionId>.json`。线上集中收集需在前端构建环境配置 `VITE_EXPERIMENT_LOG_API_URL`；未连接服务器时，记录仍会保存在参与者浏览器并可下载 JSON。

# EPUB 文本校验

项目内置了针对 PDF 重排 EPUB 的中文空格、分页断句和空白段落校验工具。普通英文词间空格不会被删除。

```bash
# 校验
python3 scripts/normalize_epub_text.py --check public/books experiments/apple-books-reader-prototype/public/books

# 修复并原地更新 EPUB
python3 scripts/normalize_epub_text.py --write public/books experiments/apple-books-reader-prototype/public/books
```
