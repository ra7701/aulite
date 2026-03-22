import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { riskColor, formatCategory } from "@/lib/api";
import { useDateRange } from "@/hooks/useDateRange";
import { useStats } from "@/hooks/useStats";
import { DateRange } from "@/components/DateRange";

const RISK_COLORS: Record<string, string> = {
  none: "#16a34a",
  low: "#2563eb",
  medium: "#d97706",
  high: "#ea580c",
  critical: "#dc2626",
};

export function Compliance() {
  const { from, to, setRange } = useDateRange();
  const { data: stats, loading } = useStats(from, to);

  const counts = useMemo(() => {
    if (!stats) return { prohibited: 0, discrimination: 0, oversight: 0 };
    const cats = stats.topCategories;
    return {
      prohibited: cats.filter((c) => c.category.startsWith("prohibited_")).reduce((s, c) => s + c.count, 0),
      discrimination: cats.filter((c) => c.category.startsWith("discrimination_") || c.category.startsWith("proxy_")).reduce((s, c) => s + c.count, 0),
      oversight: cats.filter((c) => c.category.includes("oversight") || c.category.includes("contest")).reduce((s, c) => s + c.count, 0),
    };
  }, [stats]);

  if (loading || !stats) return <div className="p-8 text-gray-400">Loading...</div>;

  const { overview, topArticles, incidents } = stats;

  const riskPieData = Object.entries(overview.riskDistribution).map(([name, value]) => ({
    name,
    value,
    color: RISK_COLORS[name] ?? "#94a3b8",
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-semibold">EU AI Act Compliance</h1>
        <DateRange from={from} to={to} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <ComplianceCard
          title="Art. 5 — Prohibited Practices"
          count={counts.prohibited}
          sub={counts.prohibited === 0 ? "No violations detected" : "CRITICAL — requires immediate review"}
        />
        <ComplianceCard
          title="Discrimination Detections"
          count={counts.discrimination}
          sub="Dir. 2000/78, 2000/43, 2006/54, EU Charter Art. 21"
        />
        <ComplianceCard
          title="Human Oversight Violations"
          count={counts.oversight}
          sub="Art. 14, GDPR Art. 22"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Risk Distribution</h2>
          {riskPieData.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={180} className="sm:!w-1/2">
                <PieChart>
                  <Pie data={riskPieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {riskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap sm:flex-col gap-2 justify-center">
                {riskPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-600 capitalize">{d.name}</span>
                    <span className="text-gray-400">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400">No data</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Violations by EU Law Article</h2>
          <div className="space-y-1.5 max-h-64 overflow-auto">
            {topArticles.length > 0 ? topArticles.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-700 flex-1 truncate pr-4">{a.articleRef}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskColor(a.avgScore) }} />
                  <span className="text-xs font-medium w-6 text-right">{a.count}</span>
                </div>
              </div>
            )) : (
              <div className="text-center text-gray-400 py-8">No violations</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-medium text-gray-500 mb-4">
          Recent Incidents (Art. 73)
        </h2>
        {incidents.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-gray-400 font-medium text-xs">Time</th>
                <th className="text-left py-2 text-gray-400 font-medium text-xs">Score</th>
                <th className="text-left py-2 text-gray-400 font-medium text-xs">Action</th>
                <th className="text-left py-2 text-gray-400 font-medium text-xs">Category</th>
              </tr>
            </thead>
            <tbody>
              {incidents.slice(0, 10).map((inc) => {
                let category = "—";
                try {
                  const checks = JSON.parse(inc.checksJson);
                  const m = checks[0]?.details?.match(/^\[([^\]]+)\]/);
                  if (m) category = formatCategory(m[1]);
                } catch { /* skip */ }

                return (
                  <tr key={inc.id} className="border-b border-gray-50">
                    <td className="py-2 text-xs text-gray-500">{new Date(inc.timestamp).toLocaleString()}</td>
                    <td className="py-2">
                      <span className="text-xs font-semibold" style={{ color: riskColor(inc.riskScore) }}>
                        {inc.riskScore}/10
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-medium ${inc.actionTaken === "block" ? "text-red-600" : "text-amber-600"}`}>
                        {inc.actionTaken.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-gray-600">{category}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center text-gray-400 py-8">No incidents in this period</div>
        )}
      </div>
    </div>
  );
}

function ComplianceCard({ title, count, sub }: { title: string; count: number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-sm text-gray-500 mb-1">{title}</div>
      <div className={`text-3xl font-semibold ${count > 0 ? "text-red-600" : "text-green-600"}`}>
        {count}
      </div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}
