# 06 · 多工具与工具选择

> 代码快照：`packages/03-multi-tool/`（v3）。在 v2（记忆）基础上新增 `get_forecast` 工具。

## 核心认知：模型选工具的唯一依据是 description

模型看不到你的代码，它只看到 tools 数组里的 **name + description + parameters**。
所以"模型会选工具"准确说是"模型会根据你写的文字描述做文本匹配"。
工具选得准不准，本质上是一个**写作问题**。

v3 的两个描述刻意形成对照（`03-multi-tool/agent.js:6-12`）：

| 工具 | 关键词 | 使用场景声明 |
|---|---|---|
| `get_weather` | **当前时刻**、实时、"只返回现在，不包含未来" | 现在多少度、此刻下雨吗、穿衣建议 |
| `get_forecast` | **未来多天**、预报 | 明天、后天、本周、出行计划 |

注意 get_weather 描述里的"只返回现在，不包含未来"——**反向声明边界**和正向声明同样重要，它防止模型拿当前天气去回答明天的问题。

## 细节 1：工具分发表

v1 用 `if (name !== "get_weather") throw`，v3 改为查表（`agent.js:50-53`）：

```javascript
const toolHandlers = {
  get_weather: getWeather,
  get_forecast: getForecast
};
```

新增工具只改两处：`tools`（给模型看的定义）+ `toolHandlers`（给程序用的实现）。
这两份信息的**同步**是多工具系统最常见的 bug 来源——定义里有的工具忘了实现、实现了忘了声明。

## 细节 2：并行 tool_calls

一个 `assistant` 消息可以携带**多个** tool_calls。实测第三轮：

```text
用户：北京今天冷吗，明天呢？
模型一轮返回：
  tool_calls[0] = get_weather({"city":"北京"})     ← 回答"今天"
  tool_calls[1] = get_forecast({"city":"北京","days":2})  ← 回答"明天"
```

程序逐个执行，结果按 `tool_call_id` 一一对应塞回 messages，下一轮模型拿着两份数据组织回答。
**触发条件**：问题包含多个相互独立的子任务，且工具之间没有依赖关系。

## 细节 3：未知工具错误喂回模型，而不是 throw

v1 遇到未知工具直接 `throw` 崩掉整轮对话；v3 改为把错误作为工具结果返回（`agent.js:100-105`）：

```javascript
result = handler
  ? await handler(args)
  : { error: `未知工具：${name}，可用工具：${Object.keys(toolHandlers).join(", ")}` };
```

模型收到后知道自己用错了名字、还拿到了合法工具清单，可以下一轮自我纠正。
**原则：能让模型自己恢复的错误，就不要让程序崩。** 这也是为什么工具执行异常一直以来都包装成 `{ error }` 返回而非抛出。

## 细节 4：并行调用放大瞬时故障

实测中出现的真实案例：两个工具并行执行 → 并发请求 Open-Meteo → `get_weather` 那次瞬时失败。
由于错误被包装成工具结果，模型优雅降级："今天当前天气这次获取失败了……明天的情况如下"。

单独重跑同一问题完全正常（瞬时抖动）。教训：**并行 tool_calls = 并发外部调用**，限流和抖动概率上升；
生产环境需要配重试、超时和降级策略（后续阶段主题）。

## 细节 5：参数也是模型"读出来"的

`get_forecast` 的 `days` 参数：用户说"未来三天"→ 模型自动生成 `{"city":"上海","days":3}`。
`parameters` 里的 `description`（"预报天数，1~16，默认 7"）和 `minimum/maximum` 约束
同样是写给模型看的说明书；程序侧的 `Math.min(Math.max(...))` 钳制是兜底，不信任模型给的值。

## 实测记录（2026-07-22）

| 提问 | 模型选择 | 评价 |
|---|---|---|
| 杭州今天天气怎么样？ | `get_weather({"city":"杭州"})` | ✅ 正确识别"今天" |
| 上海未来三天会下雨吗？ | `get_forecast({"city":"上海","days":3})` | ✅ 选对工具且提取出 days=3 |
| 北京今天冷吗，明天呢？ | 一轮内并行两个工具 | ✅ 正确拆解复合问题 |

## 可做的后续实验

- [ ] 把 get_weather 的 description 改模糊（删掉"只返回现在"），观察模型是否开始用当前天气回答明天
- [ ] 加一个 name 相似的工具（如 `get_weather_v2`），观察模型的混淆行为
- [ ] 用 `tool_choice: "required"` 强制每轮调工具，观察回答质量如何劣化

---

⬅️ 上一篇：[记忆 Memory](./05-memory.md) | [返回目录](./README.md)
