# 03 · tool_choice 参数详解

> 代码快照：`packages/01-minimal-agent/`（v1，冻结不修改，下文所有 `agent.js` 引用均指向此目录）

`tool_choice` 告诉模型**"这一轮要不要用工具、必须用哪个"**。本项目设为 `"auto"`（`agent.js:52`）。

## 可选取值

| 取值 | 含义 | 行为 |
|---|---|---|
| `"auto"` | 模型自己决定 | 需要工具就返回 `tool_calls`，不需要就直接回答 |
| `"none"` | 禁止用工具 | 只能纯文本回答，Agent 退化成普通聊天（靠训练数据瞎猜天气） |
| `"required"` | 必须用工具 | 每轮必须返回 tool_calls → 永远到不了最终回答，撞 5 轮上限报错 |
| `{type:"function", function:{name:"get_weather"}}` | 强制指定 | 这一轮必须调用指定工具 |

## 为什么用 "auto" 是 Agent 的关键

```javascript
tool_choice: "auto"                        // 决策权交给模型
// +
if (!message.tool_calls?.length) return;   // 模型决定何时停止（agent.js:61）
```

这一对组合 = **"让模型自主决定何时行动、何时停止"**，是 Agent 与普通函数调用的本质区别。

- `"auto"`：用户问"你好"→ 直接回答（1 轮退出）；问"杭州天气"→ 先调工具，拿到结果后下一轮自己决定停。
- `"none"`：模型永远拿不到天气数据。
- `"required"`：陷入无限调工具，直到超限报错。

## 注意："auto" 是允许，不是保证

模型偶尔会该调工具时编造答案，所以项目用 system prompt 兜底（`agent.js:42`）：

> "需要实时天气时**必须**调用 get_weather 工具，不要猜测天气"

生产环境更严格的做法是分轮控制：第一轮 `"auto"`，发现该调没调时，下一轮改 `"required"` 强制补上。

---

⬅️ 上一篇：[循环体现在哪里](./02-the-loop.md) | [返回目录](./README.md) | 下一篇：[Agent 的要素](./04-agent-elements.md) ➡️
