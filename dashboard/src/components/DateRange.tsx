import { daysAgo, today } from "@/lib/utils";

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

export function DateRange({ from, to, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(({ label, days }) => (
        <button
          key={label}
          onClick={() => onChange(daysAgo(days), today())}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            from === daysAgo(days)
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {label}
        </button>
      ))}
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
      />
      <span className="text-gray-400 text-xs">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
      />
    </div>
  );
}
