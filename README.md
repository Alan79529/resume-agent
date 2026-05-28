# Resume-Agent 2.0 / 面试作战助手

Resume-Agent 是一个桌面端求职助手。2.0 版本从“手动提取岗位并分析”的工具，升级为可以自主搜索、分析、保存作战卡的 Agent 工作流。

## 2.0 亮点

- Agent 模式：支持 OpenAI-compatible tool calling，能连续调用工具完成“找岗位 -> 分析 -> 保存作战卡”的闭环。
- BOSS 直聘搜索：优先复用右侧 Electron 浏览器中的登录态和当前页面，避免独立爬虫反复要求登录。
- 作战卡保存：Agent 可直接保存岗位作战卡；同公司、同岗位、同来源的重复保存会更新已有卡片。
- DeepSeek v4 flash：默认模型为 `deepseek-v4-flash`，并兼容需要回传 `reasoning_content` 的 thinking 模式。
- Python sidecar：通过 stdin/stdout JSON-RPC 调用 Python 搜索工具，包含网页搜索和 BOSS 直聘 fallback。
- 前端体验：左侧作战卡抽屉、Agent 执行轨迹、工具结果卡片、求职偏好设置、模拟面试语音输入/朗读。
- 稳定性：修复中文搜索乱码、孤立 surrogate 导致的 URL 编码异常、工具消息缺失、BOSS 登录态不可复用等问题。

## 使用方式

1. 在设置里配置 OpenAI-compatible API：
   - `API Base URL`
   - `API Key`
   - `Model`，推荐 `deepseek-v4-flash`
2. 在右侧内置浏览器打开并登录 BOSS 直聘。
3. 切换到 Agent 模式，输入类似：

```text
我想找大模型开发实习工作
```

4. Agent 会搜索岗位、结合简历分析匹配度，并在你确认后保存作战卡。

## 开发环境

```powershell
npm install
python -m venv python/.venv
python/.venv/Scripts/python.exe -m pip install -r python/requirements.txt
npm run dev
```

> Windows PowerShell 也可以使用 `python\.venv\Scripts\python.exe` 路径写法。

## 构建与测试

```powershell
npm run build
python/.venv/Scripts/python.exe -m unittest tests.python.test_search_text tests.python.test_server
```

## 关键目录

- `src/main/services/agent/`：Agent 主循环、工具注册、记忆与 prompt 构建。
- `src/main/services/python-bridge.ts`：Python sidecar 生命周期和 JSON-RPC 通信。
- `src/main/services/webview-extractor.ts`：内置浏览器页面提取和 BOSS 岗位解析。
- `python/`：Python 搜索服务和工具实现。
- `src/renderer/src/components/chat/ToolResultView.tsx`：搜索结果和岗位结果的结构化展示。
- `tests/python/`：Python sidecar 和搜索文本清洗测试。

## 注意事项

- BOSS 直聘搜索最稳定的方式是在右侧内置浏览器保持登录。Python headless 搜索只是 fallback，可能被登录校验或风控限制。
- `python/.venv/`、`.codex-run/`、`.playwright-mcp/`、`.claude/`、`Scrapling-main/` 是本地开发产物，不应提交到仓库。
- 1.0 安装包仍可在 GitHub Release 下载；2.0 当前以 `develop/2.0` 分支源码形式发布。

## 1.0 下载

- Release 页面：[v1.0.0](https://github.com/Alan79529/resume-agent/releases/tag/v1.0.0)
- Windows 安装包：[resume-agent-1.0.0-setup.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/resume-agent-1.0.0-setup.exe)
- 便携版：[Resume-Agent.exe](https://github.com/Alan79529/resume-agent/releases/download/v1.0.0/Resume-Agent.exe)

---

## English

Resume-Agent is a desktop interview-preparation app. Version 2.0 adds an agentic workflow that can search jobs, analyze fit, and save battle cards through OpenAI-compatible tool calling.

Highlights:

- Agent mode with multi-step tool calling.
- Logged-in BOSS Zhipin search through the embedded Electron browser.
- Battle-card persistence with duplicate updates.
- Default `deepseek-v4-flash` model.
- Python sidecar tools over JSON-RPC.
- Improved card drawer, tool-result cards, job preferences, and mock-interview voice features.

Development:

```powershell
npm install
python -m venv python/.venv
python/.venv/Scripts/python.exe -m pip install -r python/requirements.txt
npm run dev
```

Validation:

```powershell
npm run build
python/.venv/Scripts/python.exe -m unittest tests.python.test_search_text tests.python.test_server
```
