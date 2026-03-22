type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const envLevel = process.env.AULITE_LOG_LEVEL as LogLevel | undefined;
let currentLevel: LogLevel = envLevel && envLevel in LEVELS ? envLevel : "info";

const isTTY = process.stdout.isTTY ?? false;
const noColor = "NO_COLOR" in process.env;
const useColor = isTTY && !noColor;

const c = {
  reset: useColor ? "\x1b[0m" : "",
  bold: useColor ? "\x1b[1m" : "",
  dim: useColor ? "\x1b[2m" : "",
  red: useColor ? "\x1b[31m" : "",
  green: useColor ? "\x1b[32m" : "",
  yellow: useColor ? "\x1b[33m" : "",
  cyan: useColor ? "\x1b[36m" : "",
  gray: useColor ? "\x1b[90m" : "",
  bgRed: useColor ? "\x1b[41m\x1b[37m" : "",
};

const ICONS = {
  info: useColor ? `${c.cyan}ℹ${c.reset}` : "ℹ",
  success: useColor ? `${c.green}✓${c.reset}` : "✓",
  warn: useColor ? `${c.yellow}⚠${c.reset}` : "⚠",
  error: useColor ? `${c.red}✖${c.reset}` : "✖",
  arrow: useColor ? `${c.green}➜${c.reset}` : "➜",
  debug: useColor ? `${c.gray}⚙${c.reset}` : "⚙",
};

function timestamp(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${c.gray}${h}:${m}:${s}${c.reset}`;
}

function formatContext(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(ctx)) {
    parts.push(`${c.gray}${k}=${c.reset}${v}`);
  }
  return " " + parts.join(" ");
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function logPretty(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  let icon: string;
  let msgColor: string;

  switch (level) {
    case "debug":
      icon = ICONS.debug;
      msgColor = c.gray;
      break;
    case "info":
      icon = ICONS.info;
      msgColor = "";
      break;
    case "warn":
      icon = ICONS.warn;
      msgColor = c.yellow;
      break;
    case "error":
      icon = ICONS.error;
      msgColor = c.red;
      break;
  }

  const line = `  ${timestamp()} ${icon} ${msgColor}${message}${c.reset}${formatContext(context)}`;
  const out = level === "error" ? process.stderr : process.stdout;
  out.write(line + "\n");
}

function logJSON(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const output = JSON.stringify(entry);
  if (level === "error") {
    process.stderr.write(output + "\n");
  } else {
    process.stdout.write(output + "\n");
  }
}

const log = isTTY ? logPretty : logJSON;

export const logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => log("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};

/**
 * Print the startup banner (Vite-style).
 */
export function printBanner(opts: {
  version: string;
  port: number;
  host: string;
  provider: string;
  mode: string;
  domains: string[];
  rulesLoaded: number;
  plan: string;
  auth: boolean;
  rateLimit?: number;
  dashboard: boolean;
}): void {
  if (!isTTY) {
    logger.info("Aulite started", opts);
    return;
  }

  const lines = [
    "",
    `  ${c.bold}${c.green}AULITE${c.reset} ${c.dim}v${opts.version}${c.reset} ${opts.plan === "pro" ? `${c.green}PRO${c.reset}` : `${c.dim}FREE${c.reset}`}`,
    "",
    `  ${ICONS.arrow}  ${c.bold}Local:${c.reset}    ${c.cyan}http://localhost:${c.bold}${opts.port}${c.reset}`,
    `  ${ICONS.arrow}  ${c.bold}Provider:${c.reset} ${opts.provider}`,
    `  ${ICONS.arrow}  ${c.bold}Mode:${c.reset}     ${opts.mode === "enforcing" ? `${c.red}${opts.mode}${c.reset}` : opts.mode}`,
    `  ${ICONS.arrow}  ${c.bold}Domains:${c.reset}  ${opts.domains.join(", ")} ${c.dim}(${opts.rulesLoaded} rules)${c.reset}`,
    `  ${ICONS.arrow}  ${c.bold}Auth:${c.reset}     ${opts.auth ? `${c.green}enabled${c.reset}` : `${c.dim}disabled${c.reset}`}`,
  ];

  if (opts.rateLimit) {
    lines.push(`  ${ICONS.arrow}  ${c.bold}Rate:${c.reset}     ${opts.rateLimit} req/min`);
  }

  if (opts.dashboard) {
    lines.push(`  ${ICONS.arrow}  ${c.bold}Dashboard:${c.reset} ${c.cyan}http://localhost:${c.bold}${opts.port}${c.reset}`);
  }

  lines.push("");
  process.stdout.write(lines.join("\n") + "\n");
}

/**
 * Format an HTTP request log line (Hono-style with risk score).
 */
export function logRequest(opts: {
  method: string;
  path: string;
  status: number;
  elapsed: string;
  score?: number;
  level?: string;
  action?: string;
  checks?: number;
}): void {
  if (!isTTY) {
    logger.info("request", opts);
    return;
  }

  let statusColor = c.green;
  if (opts.status >= 500) statusColor = c.red;
  else if (opts.status >= 400) statusColor = c.yellow;
  else if (opts.status >= 300) statusColor = c.cyan;

  let line = `  ${timestamp()} ${c.dim}→${c.reset} ${c.bold}${opts.method}${c.reset} ${opts.path} ${statusColor}${opts.status}${c.reset} ${c.dim}${opts.elapsed}${c.reset}`;

  if (opts.score !== undefined && opts.score > 0) {
    let scoreColor = c.yellow;
    let icon = ICONS.warn;
    if (opts.score >= 9) { scoreColor = c.bgRed; icon = ICONS.error; }
    else if (opts.score >= 7) { scoreColor = c.red; icon = ICONS.error; }

    line += `  ${icon} ${scoreColor}score ${opts.score}${c.reset}`;

    if (opts.action === "block") {
      line += ` ${c.bgRed} BLOCKED ${c.reset}`;
    }

    if (opts.checks && opts.checks > 0) {
      line += ` ${c.dim}(${opts.checks} checks)${c.reset}`;
    }
  }

  process.stdout.write(line + "\n");
}
