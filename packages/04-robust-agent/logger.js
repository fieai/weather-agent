// 极简日志：全部输出到 stderr，不污染 stdout 的正式回答。
// 用 AGENT_LOG_LEVEL 控制级别：AGENT_LOG_LEVEL=debug npm start
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (process.env.AGENT_LOG_LEVEL || "info").toLowerCase();
const minLevel = LEVELS[configured] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function write(level, args) {
  if (LEVELS[level] < minLevel) return;
  console.error(`[${timestamp()}] [${level.toUpperCase().padEnd(5)}]`, ...args);
}

export const log = {
  debug: (...args) => write("debug", args),
  info: (...args) => write("info", args),
  warn: (...args) => write("warn", args),
  error: (...args) => write("error", args)
};
