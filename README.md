# Node.js 天气 Agent

这是一个不依赖 LangChain 的最小 Agent 示例，用来理解四个核心概念：

```text
用户问题 → 模型决定是否调用工具 → 程序执行工具 → 工具结果返回模型 → 最终回答
```

天气数据使用 Open-Meteo，不需要单独申请天气 API Key；模型需要一个 OpenAI 兼容 API Key。

## 运行

需要 Node.js 20 或更高版本。

```bash
npm install
cp .env.example .env
# 编辑 .env，填写 OPENAI_API_KEY
npm start
```

启动后可以输入：

```text
杭州今天天气怎么样？
北京现在多少度？需要穿外套吗？
```

也可以直接传入一次问题：

```bash
npm run weather -- "杭州现在的天气怎么样？"
```

## 文件说明

- `src/index.js`：命令行交互入口
- `src/agent.js`：Agent 循环和 Tool Calling
- `src/weather.js`：地理编码和天气 API 工具
- `notes/`：Agent 核心概念学习笔记（判断标准、循环、tool_choice、Agent 要素）

暂时没有使用 LangChain。先读懂 `src/agent.js` 中的 `messages`、`tool_calls` 和 `role: "tool"`，再引入框架会更容易理解。
