import { useEffect, useState } from "react";
import { fetchHealth, type HealthInfo } from "@/lib/api";
import { CheckCircle, XCircle, Shield, Database, Gauge } from "lucide-react";

export function SettingsPage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [chain, setChain] = useState<{ valid: boolean; entriesChecked: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchHealth(),
      fetch("/verify").then((r) => r.json()),
    ])
      .then(([h, v]) => { setHealth(h); setChain(v); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !health || !chain) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-2xl">
      <h1 className="text-lg sm:text-xl font-semibold">System Settings</h1>

      <Section icon={<Gauge size={16} />} title="System Status">
        <Row label="Version" value={health.version} />
        <Row label="Status" value={health.status === "ok" ? "Healthy" : health.status} ok={health.status === "ok"} />
        <Row label="Analysis Mode" value={health.mode.toUpperCase()} />
        <Row label="Authentication" value={health.auth ? "Enabled" : "Disabled"} ok={health.auth} />
        <Row label="Rate Limit" value={health.rateLimit ? `${health.rateLimit} req/min` : "Disabled"} />
      </Section>

      <Section icon={<Shield size={16} />} title="Active Compliance Domains">
        <div className="flex flex-wrap gap-2 mb-2">
          {health.domains.map((d) => (
            <span key={d} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">{d}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400">{health.rulesLoaded} rules loaded (including base rules)</p>
      </Section>

      <Section icon={<Database size={16} />} title="Audit Trail (Art. 12)">
        <Row label="Total Entries" value={(health.auditEntries ?? 0).toLocaleString()} />
        <Row
          label="Hash Chain Integrity"
          value={chain.valid ? `Valid (${chain.entriesChecked} entries verified)` : "BROKEN — tampering detected"}
          ok={chain.valid}
        />
        <Row label="Hash Algorithm" value="SHA-256" />
        <Row label="Storage" value="SQLite (WAL mode, append-only)" />
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-medium text-gray-500 flex items-center gap-2">{icon} {title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 gap-0.5 sm:gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-medium flex items-center gap-1.5 sm:text-right">
        {ok !== undefined && (
          ok ? <CheckCircle size={14} className="text-green-500 shrink-0" /> : <XCircle size={14} className="text-red-500 shrink-0" />
        )}
        <span className="break-words">{value}</span>
      </span>
    </div>
  );
}
