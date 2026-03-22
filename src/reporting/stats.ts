import type Database from "better-sqlite3";

export interface DateRange {
  from: string; // ISO date
  to: string;
}

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

export function getOverviewStats(db: Database.Database, range: DateRange): OverviewStats {
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as flagged,
      SUM(CASE WHEN action_taken = 'block' THEN 1 ELSE 0 END) as blocked,
      SUM(CASE WHEN action_taken = 'pass' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN action_taken = 'error' THEN 1 ELSE 0 END) as errors,
      COALESCE(AVG(risk_score), 0) as avg_score,
      COALESCE(MAX(risk_score), 0) as max_score
    FROM audit_entries
    WHERE timestamp >= @from AND timestamp <= @to
  `).get({ from: range.from, to: range.to }) as Record<string, number>;

  const levels = db.prepare(`
    SELECT risk_level, COUNT(*) as count
    FROM audit_entries
    WHERE timestamp >= @from AND timestamp <= @to
    GROUP BY risk_level
  `).all({ from: range.from, to: range.to }) as Array<{ risk_level: string; count: number }>;

  const riskDistribution: Record<string, number> = {};
  for (const l of levels) {
    riskDistribution[l.risk_level] = l.count;
  }

  return {
    totalRequests: row.total,
    flaggedRequests: row.flagged,
    blockedRequests: row.blocked,
    passedRequests: row.passed,
    errorRequests: row.errors,
    avgRiskScore: Math.round(row.avg_score * 100) / 100,
    maxRiskScore: row.max_score,
    riskDistribution,
  };
}

export function getTopCategories(db: Database.Database, range: DateRange, limit = 20): CategoryStat[] {
  return db.prepare(`
    SELECT
      cd.category,
      COUNT(*) as count,
      ROUND(AVG(cd.risk_score), 2) as avg_score,
      MAX(cd.risk_score) as max_score,
      cd.article_ref
    FROM check_details cd
    JOIN audit_entries ae ON cd.audit_entry_id = ae.id
    WHERE ae.timestamp >= @from AND ae.timestamp <= @to
    GROUP BY cd.category
    ORDER BY count DESC
    LIMIT @limit
  `).all({ from: range.from, to: range.to, limit }) as CategoryStat[];
}

export function getTimeSeries(db: Database.Database, range: DateRange, granularity: "hour" | "day" = "day"): TimeSeriesPoint[] {
  const fmt = granularity === "hour" ? "%Y-%m-%dT%H:00:00" : "%Y-%m-%d";

  return db.prepare(`
    SELECT
      strftime('${fmt}', timestamp) as period,
      COUNT(*) as totalRequests,
      SUM(CASE WHEN risk_score > 0 THEN 1 ELSE 0 END) as flaggedRequests,
      ROUND(AVG(risk_score), 2) as avgRiskScore
    FROM audit_entries
    WHERE timestamp >= @from AND timestamp <= @to
    GROUP BY period
    ORDER BY period ASC
  `).all({ from: range.from, to: range.to }) as TimeSeriesPoint[];
}

export function getProviderStats(db: Database.Database, range: DateRange): ProviderStat[] {
  return db.prepare(`
    SELECT
      provider,
      model,
      COUNT(*) as count,
      ROUND(AVG(risk_score), 2) as avgRiskScore
    FROM audit_entries
    WHERE timestamp >= @from AND timestamp <= @to
    GROUP BY provider, model
    ORDER BY count DESC
  `).all({ from: range.from, to: range.to }) as ProviderStat[];
}

export function getTopArticleViolations(db: Database.Database, range: DateRange, limit = 15): Array<{ articleRef: string; count: number; avgScore: number }> {
  return db.prepare(`
    SELECT
      cd.article_ref as articleRef,
      COUNT(*) as count,
      ROUND(AVG(cd.risk_score), 2) as avgScore
    FROM check_details cd
    JOIN audit_entries ae ON cd.audit_entry_id = ae.id
    WHERE ae.timestamp >= @from AND ae.timestamp <= @to
      AND cd.article_ref IS NOT NULL
    GROUP BY cd.article_ref
    ORDER BY count DESC
    LIMIT @limit
  `).all({ from: range.from, to: range.to, limit }) as Array<{ articleRef: string; count: number; avgScore: number }>;
}

export function getIncidents(db: Database.Database, range: DateRange): IncidentRecord[] {
  return db.prepare(`
    SELECT id, timestamp, risk_score as riskScore, risk_level as riskLevel,
           action_taken as actionTaken, provider, model, domains, checks_json as checksJson
    FROM audit_entries
    WHERE timestamp >= @from AND timestamp <= @to
      AND (action_taken = 'block' OR risk_score >= 7)
    ORDER BY timestamp DESC
  `).all({ from: range.from, to: range.to }) as IncidentRecord[];
}

export function getFullStats(db: Database.Database, range: DateRange) {
  return {
    period: range,
    overview: getOverviewStats(db, range),
    topCategories: getTopCategories(db, range),
    topArticles: getTopArticleViolations(db, range),
    timeSeries: getTimeSeries(db, range),
    providers: getProviderStats(db, range),
    incidents: getIncidents(db, range),
  };
}
