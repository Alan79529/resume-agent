# Resume-Agent / 面试作战助手

## 中文说明

Resume-Agent 是一个桌面端求职准备工具，支持岗位页面提取、AI 分析、作战卡沉淀、AI 模拟面试与简历资源管理。

### 下载（v1.0.0）

- Release 页面: [v1.0.0](https://github.com/Alan79529/resume-agent/releases/tag/v1.0.0)
- Windows 安装包: [resume-agent-1.0.0-setup.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/resume-agent-1.0.0-setup.exe)
- 便携可执行文件: [Resume-Agent.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/Resume-Agent.exe)

> 说明: 当前安装包未进行代码签名，Windows 可能提示“未知发布者”。请务必从官方 GitHub Release 页面下载。

### 核心功能

1. 岗位提取与 AI 分析
- 在内置浏览器打开岗位页后点击“提取并分析”
- 自动生成公司业务、JD 摘要、高频问题、注意事项、准备清单等
- 聊天中“已提取”展示的是标题预览，正文会完整提取并用于分析

2. 作战卡管理
- 一键保存分析结果为作战卡
- 卡片支持面试状态流转与复盘记录
- 长标题/岗位名支持多行显示，避免一行截断

3. 资源库（简历/自我介绍）
- 保存简历文本和自我介绍
- 分析岗位时自动注入简历上下文做匹配评估
- 支持 PDF 简历上传并自动提取文本填入“我的简历文本”

4. AI 模拟面试
- 从作战卡直接进入模拟面试模式
- AI 连续追问、打分、点评并给出优化表达建议

5. 数据导入导出与自动更新
- 支持作战卡和资源库 JSON 导入/导出
- 基于 GitHub Releases 的自动更新能力（`electron-updater`）

### 最近新增与修复

- 提取链路增强: BOSS 页面正文提取与标题去噪优化
- 字符清洗增强: 处理私有区混淆字符（方块字问题）
- 存储容错增强: 兼容 BOM JSON，避免启动解析异常
- 资源库新增: PDF 简历导入并自动提取

### PDF 简历导入说明

在“资源库”里点击“上传 PDF”即可导入。

- 推荐: 文字型 PDF（可复制文本）
- 限制: 扫描件 PDF 当前不含 OCR，可能提取不到文本

### 常见问题

1. 关闭窗口后仍占用进程，导致无法覆盖安装/打包

可执行以下命令彻底退出:

```powershell
Get-Process | Where-Object { $_.ProcessName -eq 'Resume-Agent' } | Stop-Process -Force
```

2. 作战卡出现方块字符

请升级到最新 release，历史数据会自动清洗，新增数据也会在入库前清洗。

### 开发与构建

1. 安装依赖

```bash
npm install
```

2. 开发启动

```bash
npm run dev
```

3. 生产构建

```bash
npm run build
```

4. 打包 Windows 安装程序

```bash
npx electron-builder --win --x64 --config.win.signAndEditExecutable=false
```

构建产物位于 `dist/` 目录。

### API 配置

在应用“设置”中配置:

- `API Base URL`
- `Model`
- `API Key`

默认使用 OpenAI 兼容的 Chat Completions 接口格式。

### 项目结构

- `src/main`: Electron 主进程、IPC、服务层
- `src/preload`: 安全桥接层
- `src/renderer`: React 前端
- `src/shared`: 共享类型
- `docs/superpowers`: 设计文档与实施计划

---

## English

Resume-Agent is a desktop app for interview preparation. It helps you extract job pages, generate AI battle cards, run mock interviews, and manage resume context.

### Download (v1.0.0)

- Release page: [v1.0.0](https://github.com/Alan79529/resume-agent/releases/tag/v1.0.0)
- Windows installer: [resume-agent-1.0.0-setup.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/resume-agent-1.0.0-setup.exe)
- Portable executable: [Resume-Agent.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/Resume-Agent.exe)

> Note: The installer is currently not code-signed. Windows may show an “Unknown publisher” warning.

### Core Features

1. JD extraction and AI analysis
- Open a job page in the embedded browser and click “Extract & Analyze”
- Generate structured outputs: company summary, JD summary, common questions, warnings, checklist, and more
- The “Extracted” chat line is a title preview; full body text is still analyzed

2. Battle card workflow
- Save analysis results as a battle card with one click
- Track interview status and post-interview notes
- Long card titles now display in multiple lines instead of being cut to one line

3. Resource library (resume + self intro)
- Save resume text and self-introduction
- Inject resume context into JD analysis for match scoring
- Upload PDF resume and auto-fill extracted text

4. AI mock interview
- Start from any battle card
- Receive continuous questioning, scoring, feedback, and answer optimization

5. Productization
- JSON import/export for cards and resources
- GitHub Releases based auto-update (`electron-updater`)

### Recent Improvements

- Better BOSS page extraction and title de-noising
- Private-use Unicode cleanup to fix square-box text
- BOM-tolerant store deserialization to avoid startup JSON crashes
- New PDF resume import in Resource Library

### PDF Import Notes

- Best for text-based PDFs
- Scanned image PDFs are not OCR-enabled in current version

### Troubleshooting

1. Window is closed but process is still running

```powershell
Get-Process | Where-Object { $_.ProcessName -eq 'Resume-Agent' } | Stop-Process -Force
```

2. Square-box characters in cards

Upgrade to the latest release. Existing data is migrated/sanitized, and new data is sanitized before save.

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npx electron-builder --win --x64 --config.win.signAndEditExecutable=false
```

Artifacts are generated in `dist/`.

### API Settings

Configure these values in app Settings:

- `API Base URL`
- `Model`
- `API Key`

This project uses an OpenAI-compatible Chat Completions endpoint format by default.

### Project Structure

- `src/main`: Electron main process, IPC, services
- `src/preload`: secure renderer bridge
- `src/renderer`: React UI
- `src/shared`: shared TypeScript types
- `docs/superpowers`: specs and plans
