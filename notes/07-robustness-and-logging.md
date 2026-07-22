# 07 · 健壮性与可观测性（重试 / 超时 / 缓存 / 日志）

> 代码快照：`packages/04-robust-agent/`（v4）。起因：v3 实测中 `get_weather(北京)` 瞬时失败一次。

## 问题复盘

v3 并行工具调用测试中，`get_weather(北京)` 失败、模型优雅降级。单独重跑同问题完全正常 → **Open-Meteo 免费 API 的瞬时抖动，不是代码 bug**。但它暴露了 v1~v3 的两个工程短板：

1. 任何一次网络抖动都会直接变成用户可见的"获取失败"——**没有重试**
2. 失败时看不到真实错误（错误被塞进 messages 喂给模型了，终端上无迹可寻）——**没有日志**

## v4 的四件套

### 1. 超时（`weather.js`）

```javascript
fetch(url, { signal: AbortSignal.timeout(10_000) })  // 10 秒不响应就放弃
```

没有超时的请求可能永远挂着——超时是一切重试的前提。

### 2. 重试 + 指数退避（`weather.js`）

```javascript
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try { ... return data; }
  catch { 等待 500ms → 1000ms 后重试 }  // 间隔翻倍，避免雪上加霜
}
```

三次都失败才抛错（上层照旧包装成工具结果喂回模型）。**重试只对瞬时故障有效**；如果是参数错误（HTTP 4xx），重试无意义——生产代码会区分可重试错误（5xx、超时、网络错误）与不可重试错误（4xx）。

### 3. 地理编码缓存（`weather.js`）

```javascript
const locationCache = new Map();  // 城市名 → 经纬度
```

"北京"查过一次就不再请求地理编码 API。城市的经纬度几乎不变，是缓存的理想对象。附带收益：第二轮起工具执行明显变快（实测命中缓存后 forecast 调用仅 239ms）。

### 4. 分级日志（`logger.js`）

- 全部输出到 **stderr**，不污染 stdout 的正式回答
- `AGENT_LOG_LEVEL=debug npm start` 控制级别
- 四个级别分工：
  - `INFO`：用户提问、工具调用与完成、最终回答 —— 业务的"骨架"
  - `DEBUG`：每个 HTTP 请求与耗时、工具结果原文、模型 token 用量、messages 条数 —— 排查用的"血肉"
  - `WARN`：HTTP 重试、工具返回错误 —— 值得注意但能自愈
  - `ERROR`：超过最大轮次 —— 真正的失败

## 日志里的重要发现

```
[DEBUG] 模型响应 2903ms，tokens：prompt=252 completion=53   ← 第 1 轮
[DEBUG] 模型响应 3130ms，tokens：prompt=500 completion=119  ← 第 2 轮
```

**prompt tokens 一轮内 252 → 500**：工具结果也被全量重发，量化了笔记 05 说的"token 只增不减"。这串数字就是上下文压缩（下阶段）的动机。

## 一个容易误解的点：并行 ≠ 并发

模型在一条消息里发起多个 `tool_calls` 叫**并行调用**（parallel tool calls），
但执行循环是 `for...of + await` —— **逐个串行执行**，并不并发。

```javascript
for (const toolCall of message.tool_calls) {
  result = await handler(args);   // 一个一个来
}
```

想真并发可以 `Promise.all`，但总耗时从"求和"变"取最大"的同时，也会把瞬时并发压力给到外部 API（限流风险）。串行是安全的默认值；是否并发应视工具特性决定。

## 实测记录（2026-07-22，AGENT_LOG_LEVEL=debug）

- 提问"北京今天冷吗，明天呢？" → 第 1 轮并行 2 个工具调用，全部成功
- `get_forecast` 触发**地理编码缓存命中**（`get_weather` 先查过北京）
- 第 2 轮模型综合 current + daily 数据回答，全程日志可回溯

---

⬅️ 上一篇：[多工具与工具选择](./06-multi-tool.md) | [返回目录](./README.md)
