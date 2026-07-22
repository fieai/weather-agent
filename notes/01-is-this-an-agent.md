# 01 · 这个项目是 Agent 吗？

> 代码快照：`packages/01-minimal-agent/`（v1，冻结不修改，下文所有 `agent.js` / `weather.js` 引用均指向此目录）

**是，是一个最小但真正的 Agent。**

## 判断标准

> **流程的分叉是模型决定的，还是代码写死的。**
> 代码写死的是"工作流（Workflow）"，模型决定的是"Agent"。

本项目中"调不调工具、调几次、何时停"全由模型决定，所以是 Agent。

## Agent 要素对照

核心实现在 `packages/01-minimal-agent/agent.js` 的 `runAgent()`：

| Agent 要素 | 对应代码 |
|---|---|
| 模型自主决策 | `tool_choice: "auto"`（`agent.js:52`），由模型自己判断是否调工具 |
| 工具 | `get_weather`，底层是 Open-Meteo 地理编码 + 天气 API（`weather.js`） |
| Agent 循环 | `for (let step = 0; step < 5; step++)`（`agent.js:47-90`） |
| 护栏 | 最多 5 轮防死循环；未知工具、非法 JSON 参数都有错误处理 |
| 指令引导 | system prompt："必须调用 get_weather，不要猜测天气"（`agent.js:42`） |

## 作为"最小 Agent"的简化之处

- **单工具**：只有 `get_weather`
- **无记忆**：每次 `runAgent` 都是全新 messages，CLI 多轮对话之间不共享上下文
- **单 Agent**：无规划、反思、多 Agent 协作等高级结构

---

⬅️ [返回目录](./README.md) | 下一篇：[循环体现在哪里](./02-the-loop.md) ➡️
