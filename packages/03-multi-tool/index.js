import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createAgent } from "./agent.js";

async function main() {
  // 整个会话共用一个 agent 实例，记忆跨提问保留
  const agent = createAgent();

  const question = process.argv.slice(2).join(" ").trim();
  if (question) {
    console.log(await agent.chat(question));
    return;
  }

  const readline = createInterface({ input, output });
  console.log("天气 Agent 已启动（v3 · 多工具），输入 exit 退出。\n");
  output.write("> ");

  try {
    // for await 逐行消费，比 question() 更能容忍管道输入（EOF 时不丢行）
    for await (const line of readline) {
      const userInput = line.trim();
      if (!userInput || userInput.toLowerCase() === "exit") {
        break;
      }

      try {
        console.log(`\n${await agent.chat(userInput)}\n`);
      } catch (error) {
        console.error(`\n错误：${error instanceof Error ? error.message : String(error)}\n`);
      }
      output.write("> ");
    }
  } finally {
    readline.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
