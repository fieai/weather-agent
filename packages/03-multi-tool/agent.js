import OpenAI from "openai";
import { getForecast, getWeather } from "./weather.js";

// 细节 1：description 是模型选择工具的唯一依据。
// 两个描述刻意形成对比：一个强调"当前/实时"，一个强调"未来/预报"，
// 并各自写明使用场景，让模型的选择有据可依。
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description:
        "查询一个城市当前时刻的实时天气（温度、体感、湿度、风速）。只返回现在，不包含未来。用户问当前天气、现在多少度、此刻是否下雨、穿衣建议时使用。",
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
          city: {
            type: "string",
            description: "城市名称，例如杭州、北京、Singapore"
          },
          days: {
            type: "integer",
            description: "预报天数，1~16，默认 7",
            minimum: 1,
            maximum: 16
          }
        },
        required: ["city"],
        additionalProperties: false
      }
    }
  }
];

// 细节 2：工具分发表替代 if 判断。新增工具时只改两处：
// tools 数组（给模型看的定义）+ toolHandlers（给程序用的实现）。
const toolHandlers = {
  get_weather: getWeather,
  get_forecast: getForecast
};

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
  "你是一个简洁可靠的天气助手。查当前天气用 get_weather，查未来天气用 get_forecast，不要凭记忆猜测天气。回答使用简体中文，并说明数据来源。";

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

      // 细节 3：一轮里模型可能同时发起多个 tool_calls（并行调用），
      // 这里逐个执行，并把每个结果按 tool_call_id 一一对应塞回 messages。
      for (const toolCall of message.tool_calls) {
        console.error(`[调用工具] ${toolCall.function.name}(${toolCall.function.arguments})`);

        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          throw new Error("模型生成的工具参数不是有效 JSON");
        }

        const handler = toolHandlers[toolCall.function.name];
        let result;
        try {
          // 细节 4：未知工具不再直接 throw，而是把错误作为工具结果喂回模型，
          // 让模型自己换用合法工具重试（self-correction），而不是让整个会话崩掉。
          result = handler
            ? await handler(args)
            : { error: `未知工具：${toolCall.function.name}，可用工具：${Object.keys(toolHandlers).join(", ")}` };
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
