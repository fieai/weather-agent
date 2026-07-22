// 实验：system prompt 不提工具时，模型还能选对工具吗？
// 对照三轮：完整定义 → 删掉 description → 连 name 也打乱
// 运行：node experiments/01-tool-selection-signals.mjs
import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined
});

// 与 packages/04-robust-agent 一致的工具定义
const fullTools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "查询一个城市当前时刻的实时天气（温度、体感、湿度、风速）。只返回现在，不包含未来。用户问当前天气、现在多少度、此刻是否下雨、穿衣建议时使用。",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "城市名称" } },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_forecast",
      description:
        "查询一个城市未来多天的天气预报（每天最高/最低温、降水概率）。用户问明天、后天、本周、未来几天的天气趋势或出行计划时使用。",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "城市名称" },
          days: { type: "integer", description: "预报天数，1~16，默认 7" }
        },
        required: ["city"]
      }
    }
  }
];

// 变体 A：删掉 description，只剩 name 和参数
const nameOnlyTools = fullTools.map((t) => ({
  ...t,
  function: { ...t.function, description: "" }
}));

// 变体 B：name 也打乱，description 也没有——纯参数猜测
const anonymousTools = [
  {
    type: "function",
    function: {
      name: "tool_alpha",
      description: "",
      parameters: fullTools[0].function.parameters
    }
  },
  {
    type: "function",
    function: {
      name: "tool_beta",
      description: "",
      parameters: fullTools[1].function.parameters
    }
  }
];

async function probe(label, tools, question) {
  const messages = [
    // 中性 system prompt：不提工具、不提天气、不提数据来源
    { role: "system", content: "你是一个简洁可靠的助手。" },
    { role: "user", content: question }
  ];
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.2
  });
  const message = response.choices[0]?.message;
  const calls = message.tool_calls?.map((t) => `${t.function.name}(${t.function.arguments})`);
  console.log(`[${label}] ${question}`);
  console.log(`  → ${calls?.length ? calls.join(" , ") : "（未调工具，直接回答）"}\n`);
}

const QUESTIONS = ["杭州现在多少度？", "杭州这个周末适合出游吗？"];

console.log("=== 第 1 组：完整定义（name + description），中性 system prompt ===\n");
for (const q of QUESTIONS) await probe("完整", fullTools, q);

console.log("=== 第 2 组：只剩 name，无 description ===\n");
for (const q of QUESTIONS) await probe("仅name", nameOnlyTools, q);

console.log("=== 第 3 组：name 打乱 + 无 description ===\n");
for (const q of QUESTIONS) await probe("匿名", anonymousTools, q);
