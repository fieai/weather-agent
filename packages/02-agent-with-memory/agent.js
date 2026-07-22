import OpenAI from "openai";
import { getWeather } from "./weather.js";

const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "查询一个城市当前的天气。用户提到天气、温度、下雨或穿衣建议时使用。",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description: "城市名称，例如杭州、北京、Singapore"
          }
        },
        required: ["city"],
        additionalProperties: false
      }
    }
  }
];

function createClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("缺少 OPENAI_API_KEY，请复制 .env.example 为 .env 后填写");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined
  });
}

const SYSTEM_PROMPT =
  "你是一个简洁可靠的天气助手。需要实时天气时必须调用 get_weather 工具，不要猜测天气。回答使用简体中文，并说明数据来源。";

// v2 与 v1 的唯一本质区别：messages 提升到会话级。
// v1 的 runAgent 每次调用都新建 messages（无记忆）；
// v2 的 createAgent 把 messages 保存在闭包里，跨提问持续累积（有记忆）。
export function createAgent() {
  const client = createClient();
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  async function chat(userInput) {
    messages.push({ role: "user", content: userInput });

    for (let step = 0; step < 5; step += 1) {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2
      });
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error("模型没有返回有效消息");
      }

      messages.push(message);
      if (!message.tool_calls?.length) {
        return message.content || "模型没有生成文本回答";
      }

      for (const toolCall of message.tool_calls) {
        if (toolCall.function.name !== "get_weather") {
          throw new Error(`未知工具：${toolCall.function.name}`);
        }

        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          throw new Error("模型生成的工具参数不是有效 JSON");
        }

        let result;
        try {
          result = await getWeather(args);
        } catch (error) {
          result = { error: error instanceof Error ? error.message : String(error) };
        }

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    throw new Error("Agent 超过最大工具调用轮次");
  }

  return { chat };
}
