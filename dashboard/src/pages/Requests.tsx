import { useState } from "react";
import { riskColor, riskLabel, formatCategory, type IncidentRecord } from "@/lib/api";
import { useDateRange } from "@/hooks/useDateRange";
import { useStats } from "@/hooks/useStats";
import { DateRange } from "@/components/DateRange";

interface CheckDetail {
  check: string;
  riskScore: number;
  riskLevel: string;
  details: string;
  articleRef?: string;
  flaggedContent?: string;
}

function parseChecks(json: string): CheckDetail[] {
  try { return JSON.parse(json); } catch { return []; }
}

export function Requests() {
  const { from, to, setRange } = useDateRange();
  const { data: stats, loading } = useStats(from, to);
  const [selected, setSelected] = useState<IncidentRecord | null>(null);

  const incidents = stats?.incidents ?? [];
  const checks = selected ? parseChecks(selected.checksJson) : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-semibold">Flagged Requests</h1>
        <DateRange from={from} to={to} onChange={setRange} />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-160px)]">
        <div className="lg:w-1/2 bg-white rounded-xl border border-gray-200 overflow-auto max-h-[50vh] lg:max-h-none">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : incidents.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No flagged requests in this period</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Level</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Model</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    onClick={() => setSelected(inc)}
                    className={`cursor-pointer border-b border-gray-100 transition-colors ${
                      selected?.id === inc.id ? "bg-blue-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(inc.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block w-8 text-center text-xs font-semibold py-0.5 rounded text-white"
                        style={{ backgroundColor: riskColor(inc.riskScore) }}
                      >
                        {inc.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{riskLabel(inc.riskLevel)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${inc.actionTaken === "block" ? "text-red-600" : "text-amber-600"}`}>
                        {inc.actionTaken.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{inc.model ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="lg:w-1/2 bg-white rounded-xl border border-gray-200 overflow-auto p-4 sm:p-5">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              Select a request to view details
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">Request Details</h2>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-400">ID</dt>
                  <dd className="font-mono text-xs truncate">{selected.id}</dd>
                  <dt className="text-gray-400">Timestamp</dt>
                  <dd>{new Date(selected.timestamp).toLocaleString()}</dd>
                  <dt className="text-gray-400">Risk Score</dt>
                  <dd className="font-semibold" style={{ color: riskColor(selected.riskScore) }}>
                    {selected.riskScore} / 10 — {riskLabel(selected.riskLevel)}
                  </dd>
                  <dt className="text-gray-400">Action</dt>
                  <dd className={selected.actionTaken === "block" ? "text-red-600 font-medium" : "text-amber-600 font-medium"}>
                    {selected.actionTaken.toUpperCase()}
                  </dd>
                  <dt className="text-gray-400">Provider</dt>
                  <dd>{selected.provider}</dd>
                  <dt className="text-gray-400">Model</dt>
                  <dd>{selected.model ?? "—"}</dd>
                </dl>
              </div>

              <div>
                <h2 className="text-sm font-medium text-gray-500 mb-2">Compliance Checks ({checks.length})</h2>
                <div className="space-y-2">
                  {checks.map((c, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{formatCategory(c.check)}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: riskColor(c.riskScore) }}
                        >
                          {c.riskScore}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{c.details}</p>
                      {c.articleRef && <p className="text-xs text-blue-600">{c.articleRef}</p>}
                      {c.flaggedContent && (
                        <p className="text-xs text-red-500 mt-1 font-mono bg-red-50 px-2 py-1 rounded">
                          {c.flaggedContent}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
