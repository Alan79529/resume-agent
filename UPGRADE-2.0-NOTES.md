# Resume-Agent 2.0 升级说明

> 分支：`develop/2.0`
> 更新日期：2026-05-28
> 技术栈：Electron、React、Zustand、TypeScript、Python sidecar、OpenAI-compatible Chat Completions

## 升级目标

2.0 的目标是把 Resume-Agent 从被动工具升级为主动求职 Agent。用户不再需要逐页手动提取岗位信息，而是可以用自然语言提出目标，例如“我想找大模型开发实习工作”，由 Agent 自主搜索、读取简历、分析匹配度，并在确认后保存作战卡。

## 已交付能力

### Agent 主流程

- 新增 `src/main/services/agent/`，包含工具定义、执行循环、记忆构建和类型定义。
- 支持最多 6 步 tool-calling 循环，并向前端实时推送执行进度。
- 前端展示 Agent 步骤、工具调用、工具结果和执行轨迹。
- 加入单任务锁，避免多个 Agent 任务同时竞争浏览器和 Python sidecar。
- 将最近对话上下文传给 Agent，使“确认”“保存前两个”“把推荐的四个都保存”等追问能正确衔接上一轮。

### 模型与工具调用

- OpenAI-compatible provider 新增 `chatWithTools()`。
- 正确处理 assistant tool calls、`tool` role 消息和 `tool_call_id`。
- 默认模型切换为 `deepseek-v4-flash`。
- 兼容 DeepSeek v4 thinking 模式要求的 `reasoning_content` 回传。
- 对旧配置中的 `deepseek-chat`、`deepseekv4flash` 做迁移，避免模型名错误。

### BOSS 直聘搜索

- 优先使用右侧 Electron webview 的登录态搜索和解析 BOSS 岗位。
- Python `boss_search` 保留为 fallback，并提供更友好的登录、风控、超时提示。
- 修复中文关键词乱码和孤立 surrogate 导致的 `UnicodeEncodeError`。
- 增加搜索文本清洗逻辑，处理 mojibake、截断的“实”等异常输入。

### 作战卡保存

- Agent 工具 `save_battle_card` 直接写入本地作战卡仓库。
- 保存成功后前端自动刷新并选中新卡片。
- 返回 `artifacts.cardIds`，让 UI 和持久化结果保持一致。
- 增加重复保存保护：同公司、同岗位、同来源 URL 的保存会更新已有卡片，而不是生成重复卡。

### Python sidecar

- 新增 `python/server.py`，通过 stdin/stdout JSON-RPC 与主进程通信。
- 新增 `python/tools/web_search.py`、`boss_search.py`、`search_text.py`。
- 输出 JSON 使用 `ensure_ascii=True`，避免 Windows GBK 终端下中文日志导致编码崩溃。
- 修复 `server.py` 作为 `__main__` 运行时工具注册模块不一致的问题。

### 前端 UI/UX

- 作战卡列表改为抽屉式面板，减少启动后的中间空白。
- 优化 Agent 模式头部、步骤卡、工具标签和消息气泡。
- 新增 `ToolResultView`，结构化展示网页搜索和 BOSS 岗位结果。
- 设置页新增求职偏好：城市、薪资、行业、岗位类型、排除公司和备注。
- 模拟面试支持语音输入和 AI 朗读。
- Webview 区域、标签栏、侧边栏和输入区做了视觉细节打磨。

## 关键文件

- `src/main/services/agent/types.ts`
- `src/main/services/agent/tools.ts`
- `src/main/services/agent/planner-executor.ts`
- `src/main/services/agent/memory.ts`
- `src/main/services/python-bridge.ts`
- `src/main/services/webview-extractor.ts`
- `python/server.py`
- `python/tools/search_text.py`
- `python/tools/web_search.py`
- `python/tools/boss_search.py`
- `src/renderer/src/components/chat/ToolResultView.tsx`
- `tests/python/test_search_text.py`
- `tests/python/test_server.py`

## QA 记录

已验证：

- Agent 可在 BOSS 登录态下搜索“大模型开发/大模型实习”等岗位。
- Agent 可根据上下文继续执行“保存前两个”“确认保存”等任务。
- 作战卡保存成功后左侧列表会刷新。
- 重复测试导致的重复卡片问题已通过去重更新逻辑修复。
- BOSS 登录态问题已改为优先复用内置浏览器，避免反复要求登录。

命令验证：

```powershell
npm run build
python/.venv/Scripts/python.exe -m unittest tests.python.test_search_text tests.python.test_server
git diff --check
```

## 已知限制

- BOSS 直聘页面结构和风控策略可能变化，webview 解析优先，Python headless 只作为降级路径。
- Agent 的岗位推荐质量依赖当前页面可见信息、搜索结果和模型推理质量。
- 当前 2.0 以源码分支发布，尚未打包新的 Windows 安装包。

## 本次发布不包含

以下内容属于本地开发产物，已加入 `.gitignore`，不会提交：

- `.codex-run/`
- `.playwright-mcp/`
- `.claude/`
- `CLAUDE.md`
- `Scrapling-main/`
- `python/.venv/`
- Python `__pycache__/` 和 `.pyc`
