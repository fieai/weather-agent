# 02 · 循环体现在哪里？

> 代码快照：`packages/01-minimal-agent/`（v1，冻结不修改，下文所有 `agent.js` 引用均指向此目录）

循环在 `packages/01-minimal-agent/agent.js:47-90` 的 `for` 循环，构成 **"模型 → 工具 → 模型"** 的往返：

```javascript
for (let step = 0; step < 5; step += 1) {        // 循环入口，最多 5 轮
  const response = await client.chat.completions.create({ messages, tools, ... }); // ① 问模型
  messages.push(message);                        // ② 模型的话存入上下文
  if (!message.tool_calls?.length) {
    return message.content;                      // ③ 出口：模型不调工具 → 结束
  }
  for (const toolCall of message.tool_calls) {   // ④ 执行工具
    messages.push({ role: "tool", ... });        // ⑤ 工具结果塞回上下文
  }
  // 没有 return → 进入下一轮，回到 ①
}
```

## 实例推演："北京和杭州哪个更暖和？"

```text
第 1 轮 (step=0)
  ① 发给模型：system + 用户问题
  ② 模型回复：调 get_weather(北京) 和 get_weather(杭州)
  ③ 有 tool_calls，不退出
  ④ 执行两次天气 API
  ⑤ messages 追加 2 条 role:"tool" 的结果
  ── 循环继续 ──

第 2 轮 (step=1)
  ① 发给模型：全量历史（含两条天气数据）
  ② 模型回答："北京 12°C，杭州 18°C，杭州更暖和"
  ③ 无 tool_calls → return，循环结束
```

## 三个关键点

1. **`messages` 是循环的载体**（`agent.js:60, 84-88`）：每轮追加模型请求和工具结果，下一轮带着全量历史再问模型——信息在循环中积累。

2. **循环次数由模型决定，不由程序写死**：模型觉得信息够了就不再调工具。"你好"可能 1 轮结束，复杂问题多轮。

3. **5 是保险丝不是流程**：`step < 5` 只是防模型无限调工具的兜底（超限在 `agent.js:92` 报错），正常走不满 5 轮。

## 没有循环会怎样

模型发出 tool_calls 后，执行结果无法送回模型，模型永远拿不到天气数据生成最终回答。**正是循环让工具结果回流给模型，形成闭环。**

---

⬅️ 上一篇：[这个项目是 Agent 吗](./01-is-this-an-agent.md) | [返回目录](./README.md) | 下一篇：[tool_choice 参数](./03-tool-choice.md) ➡️
