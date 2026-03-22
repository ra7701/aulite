import { FileText, Download, Shield, AlertTriangle } from "lucide-react";
import { downloadReport } from "@/lib/api";
import { useDateRange } from "@/hooks/useDateRange";

const REPORTS = [
  {
    id: "audit" as const,
    title: "Compliance Audit Report",
    article: "Art. 12 — Record-Keeping",
    description: "Evidence of continuous automated monitoring. Includes risk distribution, top violations, article references, and audit trail integrity verification.",
    icon: FileText,
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    id: "fria" as const,
    title: "Fundamental Rights Impact Assessment",
    article: "Art. 27 — FRIA Draft",
    description: "Pre-filled draft with 6 mandatory sections (a-f). Sections requiring human input are marked [ACTION REQUIRED]. Based on monitoring data.",
    icon: Shield,
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    id: "incidents" as const,
    title: "Incident Report",
    article: "Art. 73 — Serious Incidents",
    description: "Documents blocked and critical-risk requests. Includes incident details, compliance checks, and required actions for market surveillance notification.",
    icon: AlertTriangle,
    color: "bg-red-50 text-red-600 border-red-200",
  },
];

export function Reports() {
  const { from, to, setRange } = useDateRange();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <h1 className="text-lg sm:text-xl font-semibold">Generate Reports</h1>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setRange(e.target.value, to)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setRange(from, e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        {REPORTS.map(({ id, title, article, description, icon: Icon, color }) => (
          <div key={id} className={`rounded-xl border p-4 sm:p-6 ${color}`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <Icon size={22} className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm sm:text-base">{title}</h2>
                  <p className="text-sm opacity-80 mt-0.5">{article}</p>
                  <p className="text-sm opacity-60 mt-2 leading-relaxed">{description}</p>
                </div>
              </div>
              <button
                onClick={() => downloadReport(id, from, to)}
                className="flex items-center justify-center gap-1.5 bg-white/80 hover:bg-white w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm shrink-0"
              >
                <Download size={14} />
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="max-w-2xl bg-gray-50 rounded-xl border border-gray-200 p-4 sm:p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Retention Requirements</h3>
        <ul className="text-sm text-gray-500 space-y-1">
          <li>Art. 26(6) — Deployers must retain logs for at least <strong>6 months</strong></li>
          <li>Art. 11 — Technical documentation retained for <strong>10 years</strong></li>
          <li>Art. 73 — Incident reports: <strong>15 days</strong> standard, <strong>2 days</strong> critical</li>
        </ul>
      </div>
    </div>
  );
}
