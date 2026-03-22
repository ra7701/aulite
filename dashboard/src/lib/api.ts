export interface OverviewStats {
  totalRequests: number;
  flaggedRequests: number;
  blockedRequests: number;
  passedRequests: number;
  errorRequests: number;
  avgRiskScore: number;
  maxRiskScore: number;
  riskDistribution: Record<string, number>;
}

export interface CategoryStat {
  category: string;
  count: number;
  avgScore: number;
  maxScore: number;
  articleRef: string | null;
}

export interface TimeSeriesPoint {
  period: string;
  totalRequests: number;
  flaggedRequests: number;
  avgRiskScore: number;
}

export interface ProviderStat {
  provider: string;
  model: string | null;
  count: number;
  avgRiskScore: number;
}

export interface IncidentRecord {
  id: string;
  timestamp: string;
  riskScore: number;
  riskLevel: string;
  actionTaken: string;
  provider: string;
  model: string | null;
  domains: string;
  checksJson: string;
}

export interface FullStats {
  period: { from: string; to: string };
  overview: OverviewStats;
  topCategories: CategoryStat[];
  topArticles: Array<{ articleRef: string; count: number; avgScore: number }>;
  timeSeries: TimeSeriesPoint[];
  providers: ProviderStat[];
  incidents: IncidentRecord[];
}

export interface HealthInfo {
  status: string;
  version: string;
  plan: string;
  mode: string;
  domains: string[];
  rulesLoaded: number;
  auditEntries: number;
  auth: boolean;
  rateLimit: number | null;
  dashboardPages: string[];
}

export async function fetchStats(from?: string, to?: string): Promise<FullStats> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/api/stats?${params}`);
  if (!res.ok) throw new Error(`Stats API error: ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error(`Health API error: ${res.status}`);
  return res.json();
}

export function downloadReport(type: "audit" | "fria" | "incidents", from?: string, to?: string): void {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  window.open(`/api/reports/${type}?${params}`, "_blank");
}

export function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function riskColor(score: number): string {
  if (score >= 9) return "#dc2626";
  if (score >= 7) return "#ea580c";
  if (score >= 4) return "#d97706";
  if (score > 0) return "#2563eb";
  return "#16a34a";
}

export function riskLabel(level: string): string {
  const map: Record<string, string> = {
    none: "None",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };
  return map[level] ?? level;
}
