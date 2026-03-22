import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import type { KeywordRule, LoadedRulePack } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface MergedRules {
  rules: Array<{ regex: RegExp; rule: KeywordRule }>;
  prompt: string;
}

export interface DomainInfo {
  name: string;
  description: string;
  ruleCount: number;
}

const cache = new Map<string, MergedRules>();
let resolvedRulesDir: string | null = null;

/**
 * Auto-detect the rules directory. Works in:
 * - Dev mode (tsx): __dirname = src/rules/
 * - Production bundle (tsup): dist/rules/ or cwd/dist/rules/
 * - Docker: /app/dist/rules/ or /app/rules/
 * Can be overridden via AULITE_RULES_DIR env var.
 */
function findRulesDir(): string {
  if (resolvedRulesDir) return resolvedRulesDir;

  if (process.env.AULITE_RULES_DIR) {
    const dir = resolve(process.env.AULITE_RULES_DIR);
    if (existsSync(resolve(dir, "base", "rules.yml"))) {
      resolvedRulesDir = dir;
      return dir;
    }
    throw new Error(
      `AULITE_RULES_DIR="${process.env.AULITE_RULES_DIR}" does not contain base/rules.yml`,
    );
  }

  const candidates = [
    __dirname, // dev: src/rules/
    resolve(__dirname, "rules"), // prod bundled: dist/ → dist/rules/
    resolve(process.cwd(), "dist", "rules"),
    resolve(process.cwd(), "src", "rules"),
    resolve(process.cwd(), "rules"),
  ];

  for (const dir of candidates) {
    if (existsSync(resolve(dir, "base", "rules.yml"))) {
      resolvedRulesDir = dir;
      return dir;
    }
  }

  throw new Error(
    "Could not find rules directory.\n" +
      "Set AULITE_RULES_DIR env var or 'analysis.rulesDir' in config.\n" +
      `Searched: ${candidates.join(", ")}`,
  );
}

function loadPack(dir: string, domain: string): LoadedRulePack {
  const rulesPath = resolve(dir, "rules.yml");
  const promptPath = resolve(dir, "prompt.txt");

  if (!existsSync(rulesPath)) {
    throw new Error(`Rule pack "${domain}" missing rules.yml at ${rulesPath}`);
  }

  const rules = parseYaml(readFileSync(rulesPath, "utf-8")) as KeywordRule[];
  const prompt = existsSync(promptPath) ? readFileSync(promptPath, "utf-8") : "";

  return { domain, rules, prompt };
}

export function loadRulePacks(domains: string[], rulesDir?: string): MergedRules {
  const cacheKey = `${rulesDir ?? ""}:${[...domains].sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const baseDir = rulesDir ? resolve(rulesDir) : findRulesDir();

  const basePack = loadPack(resolve(baseDir, "base"), "base");

  const domainPacks: LoadedRulePack[] = [];
  for (const domain of domains) {
    const dir = resolve(baseDir, domain);
    if (!existsSync(dir)) {
      const available = discoverDomains(baseDir);
      const listing = available.map((d) => `  - ${d.name}: ${d.description}`).join("\n");
      throw new Error(
        `Unknown domain: "${domain}".\n\nAvailable domains:\n${listing}\n\n` +
          `Configure domains in aulite.config.yml or via AULITE_DOMAINS env var.`,
      );
    }
    domainPacks.push(loadPack(dir, domain));
  }

  const allRules = [...basePack.rules];
  for (const pack of domainPacks) {
    allRules.push(...pack.rules);
  }

  const compiled = allRules.map((rule) => ({
    regex: new RegExp(rule.pattern, "gi"),
    rule,
  }));

  const promptParts = [basePack.prompt];
  for (const pack of domainPacks) {
    if (pack.prompt) {
      promptParts.push(pack.prompt);
    }
  }

  const result: MergedRules = {
    rules: compiled,
    prompt: promptParts.join("\n\n"),
  };

  cache.set(cacheKey, result);
  return result;
}

/** Discover all available domain packs by scanning the rules directory. */
export function discoverDomains(rulesDir?: string): DomainInfo[] {
  const baseDir = rulesDir ?? findRulesDir();
  const entries = readdirSync(baseDir, { withFileTypes: true });

  const result: DomainInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "base") continue;

    const dir = resolve(baseDir, entry.name);
    const rulesPath = resolve(dir, "rules.yml");
    if (!existsSync(rulesPath)) continue;

    let description = entry.name;
    const promptPath = resolve(dir, "prompt.txt");
    if (existsSync(promptPath)) {
      const firstLine = readFileSync(promptPath, "utf-8").split("\n")[0];
      const match = firstLine.match(/DOMAIN-SPECIFIC ANALYSIS:\s*(.+)/);
      if (match) description = match[1].trim();
    }

    const rules = parseYaml(readFileSync(rulesPath, "utf-8")) as KeywordRule[];
    result.push({ name: entry.name, description, ruleCount: rules.length });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

/** Clear the internal cache. Useful for testing. */
export function clearRuleCache(): void {
  cache.clear();
  resolvedRulesDir = null;
}
