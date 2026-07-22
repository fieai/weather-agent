import OpenAI from "openai";
import { getForecast, getWeather } from "./weather.js";
import { log } from "./logger.js";

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
    log.info(`用户提问：${userInput}`);
    messages.push({ role: "user", content: userInput });

    for (let step = 0; step < 5; step += 1) {
      log.debug(`Agent 第 ${step + 1} 轮，messages 共 ${messages.length} 条`);
      const llmStart = Date.now();
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        tools,
        tool_choice: "auto",
        temperature: 0.2
      });
      const usage = response.usage;
      log.debug(
        `模型响应 ${Date.now() - llmStart}ms，` +
        `tokens：prompt=${usage?.prompt_tokens ?? "?"} completion=${usage?.completion_tokens ?? "?"}`
      );

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error("模型没有返回有效消息");
      }

      messages.push(message);
      if (!message.tool_calls?.length) {
        log.info(`模型给出最终回答（第 ${step + 1} 轮，无工具调用）`);
        return message.content || "模型没有生成文本回答";
      }

      log.info(`模型请求 ${message.tool_calls.length} 个工具调用`);
      for (const toolCall of message.tool_calls) {
        log.info(`调用工具 ${toolCall.function.name}(${toolCall.function.arguments})`);

        let args;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          throw new Error("模型生成的工具参数不是有效 JSON");
        }

        const handler = toolHandlers[toolCall.function.name];
        const toolStart = Date.now();
        let result;
        try {
          result = handler
            ? await handler(args)
            : { error: `未知工具：${toolCall.function.name}，可用工具：${Object.keys(toolHandlers).join(", ")}` };
        } catch (error) {
          result = { error: error instanceof Error ? error.message : String(error) };
        }

        const elapsed = Date.now() - toolStart;
        if (result && typeof result === "object" && "error" in result) {
          log.warn(`工具 ${toolCall.function.name} 返回错误（${elapsed}ms）：${result.error}`);
        } else {
          log.info(`工具 ${toolCall.function.name} 完成（${elapsed}ms）`);
        }
        log.debug(`工具结果：${JSON.stringify(result)}`);

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    log.error("超过最大工具调用轮次");
    throw new Error("Agent 超过最大工具调用轮次");
  }

  return { chat };
}
