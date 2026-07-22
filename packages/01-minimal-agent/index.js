import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runAgent } from "./agent.js";

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (question) {
    console.log(await runAgent(question));
    return;
  }

  const readline = createInterface({ input, output });
  console.log("天气 Agent 已启动，输入 exit 退出。\n");

  try {
    while (true) {
      const userInput = (await readline.question("> ")).trim();
      if (!userInput || userInput.toLowerCase() === "exit") {
        break;
      }

      try {
        console.log(`\n${await runAgent(userInput)}\n`);
      } catch (error) {
        console.error(`\n错误：${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  } finally {
    readline.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
