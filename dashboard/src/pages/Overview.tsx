import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, AlertTriangle, ShieldOff, CheckCircle } from "lucide-react";
import { formatCategory, riskColor } from "@/lib/api";
import { useDateRange } from "@/hooks/useDateRange";
import { useStats } from "@/hooks/useStats";
import { StatsCard } from "@/components/StatsCard";
import { DateRange } from "@/components/DateRange";

export function Overview() {
  const { from, to, setRange } = useDateRange();
  const { data: stats, loading } = useStats(from, to);

  if (loading || !stats) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { overview, topCategories, topArticles, timeSeries } = stats;
  const flagRate = overview.totalRequests > 0
    ? ((overview.flaggedRequests / overview.totalRequests) * 100).toFixed(1)
    : "0";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-semibold">Compliance Overview</h1>
        <DateRange from={from} to={to} onChange={setRange} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatsCard
          label="Total Requests"
          value={(overview.totalRequests ?? 0).toLocaleString()}
          icon={<Activity size={18} />}
        />
        <StatsCard
          label="Flagged"
          value={(overview.flaggedRequests ?? 0).toLocaleString()}
          sub={`${flagRate}% detection rate`}
          icon={<AlertTriangle size={18} />}
          color="text-amber-600"
        />
        <StatsCard
          label="Blocked"
          value={(overview.blockedRequests ?? 0).toLocaleString()}
          icon={<ShieldOff size={18} />}
          color="text-red-600"
        />
        <StatsCard
          label="Clean"
          value={(overview.passedRequests ?? 0).toLocaleString()}
          icon={<CheckCircle size={18} />}
          color="text-green-600"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Risk Score Over Time</h2>
        {timeSeries.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeSeries} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} width={35} />
              <Tooltip />
              <Area type="monotone" dataKey="avgRiskScore" stroke="#2563eb" fill="#dbeafe" name="Avg Risk Score" />
              <Area type="monotone" dataKey="flaggedRequests" stroke="#d97706" fill="#fef3c7" name="Flagged" yAxisId={0} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm text-center">No data in this period</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Top Violation Categories</h2>
          {topCategories.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-auto">
              {topCategories.slice(0, 10).map((c, i) => {
                const pct = topCategories[0].count > 0 ? (c.count / topCategories[0].count) * 100 : 0;
                return (
                  <div key={i} className="relative">
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg opacity-10"
                      style={{ width: `${pct}%`, backgroundColor: riskColor(c.avgScore) }}
                    />
                    <div className="relative flex items-center justify-between py-2 px-3">
                      <span className="text-sm text-gray-700 truncate flex-1 mr-2">{formatCategory(c.category)}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400">avg {c.avgScore}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full text-white min-w-[28px] text-center"
                          style={{ backgroundColor: riskColor(c.avgScore) }}
                        >
                          {c.count}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm text-center">No violations detected</div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">EU AI Act Article Violations</h2>
          {topArticles.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-auto">
              {topArticles.map((a, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700 truncate flex-1">{a.articleRef}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">avg {a.avgScore}</span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: riskColor(a.avgScore) }}
                    >
                      {a.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm text-center">No article violations detected</div>
          )}
        </div>
      </div>
    </div>
  );
}
