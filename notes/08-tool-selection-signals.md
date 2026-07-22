# 08 · 工具选择的信号层级（system prompt 不是主力）

> 实验代码：`experiments/01-tool-selection-signals.mjs`（独立于版本快照，可随时重跑）

## 问题

多工具区分只能靠 system prompt 里写"查当前用 get_weather，查未来用 get_forecast"吗？

## 答案：不是。信号有六个层级

| 层级 | 信号 | 性质 | 控制方 |
|---|---|---|---|
| 1 | 工具 `description` | **主力**，每个工具的岗位说明书 | 模型参考 |
| 2 | 工具 `name` | 语义化命名自带信息 | 模型参考 |
| 3 | 参数名 + 参数 description + schema | 隐藏信号通道 | 模型参考 |
| 4 | system prompt | 全局策略（调不调、怎么答），不做具体选择 | 模型参考 |
| 5 | few-shot 示例（messages 里的示范对话） | 行为示范 | 模型参考 |
| 6 | `tool_choice` | **硬约束**，直接绕过模型决策 | 程序强制 |

前 5 层都是"建议"，模型可以不听；只有第 6 层是强制的。

## 实验记录（2026-07-22）

中性 system prompt（"你是一个简洁可靠的助手"，不提工具、不提天气）：

| 组别 | 工具定义 | "杭州现在多少度？" | "杭州周末适合出游吗？" |
|---|---|---|---|
| 完整（name+description） | 全量 | ✅ get_weather | ✅ get_forecast(days:3) |
| 仅 name（无 description） | 删描述 | ✅ get_weather | ✅ get_forecast(days:2) |
| 匿名（name 打乱+无描述） | tool_alpha/beta | ✅ alpha | ✅ beta(days:2) |

### 第 3 组的意外发现

实验设计本意是"纯匿名绝境"，但**参数里的 `days` description（"预报天数，1~16，默认 7"）忘了删**——模型正是靠读参数描述推断出 tool_beta 是预报工具。

结论：信号藏在你写给模型看的**每一个文本字段**里，包括参数描述、枚举值、甚至参数名本身。

## system prompt 的真实职责

- **调不调**："不要凭记忆猜测天气"（vs 直接编造答案）
- **怎么答**：语言、风格、数据来源声明
- **兜底冗余**："查当前用 A 查未来用 B" 只是保险，选择本身由 description 完成

## 工程推论

1. 工具选不准时，**先改 description，再动 system prompt**
2. 命名就是文档：`get_forecast` 比 `query_data_v2` 值钱
3. 参数描述不是可选项——它既影响选择，也影响参数生成质量（实测模型自动提取"三天"→ days:3）
4. 想完全锁死行为，用 `tool_choice` 硬控，别指望 prompt

---

⬅️ 上一篇：[健壮性与日志](./07-robustness-and-logging.md) | [返回目录](./README.md)
