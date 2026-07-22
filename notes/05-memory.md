# 05 · 记忆（Memory）

> 代码快照：`packages/02-agent-with-memory/`（v2）。与 v1（`packages/01-minimal-agent/`）的差异仅在消息的生命周期。

## 核心认知：LLM API 本身是无状态的

模型不会"记得"你说过什么。所谓记忆，**就是每次请求都把历史消息重新发一遍**。
`messages` 数组就是记忆的全部——没有什么魔法。

## v1 → v2 的改动

v1 的 `runAgent(userInput)`：每次调用都新建 `messages`，问完即忘。

```javascript
// v1：messages 是局部变量，每次提问从零开始
export async function runAgent(userInput) {
  const messages = [{ role: "system", ... }, { role: "user", content: userInput }];
  ...
}
```

v2 的 `createAgent()`：用闭包把 `messages` 提升到**会话级**，跨提问持续累积。

```javascript
// v2：messages 活在闭包里，与会话同生命周期
export function createAgent() {
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  async function chat(userInput) {
    messages.push({ role: "user", content: userInput });
    // 循环部分与 v1 完全相同
    ...
  }

  return { chat };
}
```

入口侧：`index.js` 在启动时创建**一个** agent 实例，整个会话共用（`02-agent-with-memory/index.js:7`）。

## 两个"循环"不要混淆

| | Agent 循环（for 5 轮） | 会话循环（while 提问） |
|---|---|---|
| 范围 | **一次提问内部**：模型 ↔ 工具往返 | **跨提问**：用户问了一轮又一轮 |
| 退出 | 模型不再调工具 | 用户输入 exit |
| 积累的消息 | tool_calls + tool 结果 | 完整的一问一答 |

v2 的关键：**Agent 循环产生的所有中间消息（tool_calls、tool 结果）也留在 messages 里**，所以后续提问能引用之前查过的数据。

## 实测记录（2026-07-22）

```text
> 杭州现在天气怎么样？   → 调 get_weather(杭州)，34°C 阴
> 北京呢？               → 理解"呢"= 同样问题，调 get_weather(北京)，23.6°C 雷雨
> 哪个城市更暖和？       → 不调工具，直接用记忆中的两条数据对比回答
```

第三轮证明了记忆的真实效果：模型能看到前两轮的工具结果，省去了重复查询。

## 记忆带来的新问题（后续阶段）

1. **Token 只增不减**：每轮对话都全量重发历史，成本随轮次线性增长，最终撞上下文上限 → 需要压缩（compaction）/ 截断 / 摘要
2. **错误会累积**：早期的错误信息留在记忆里会持续误导模型
3. **多用户场景**：每个会话需要独立的 messages（本项目的闭包结构天然支持：`createAgent()` 一次 = 一个会话）

## 顺带修复

v2 把 CLI 的 `readline.question()` 循环改为 `for await (const line of readline)`。
原因：管道输入时 `question()` 在 EOF 后会 reject（`readline was closed`），异步迭代器逐行消费更健壮。

---

⬅️ 上一篇：[Agent 的要素](./04-agent-elements.md) | [返回目录](./README.md)
