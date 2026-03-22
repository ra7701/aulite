import { useEffect, useState } from "react";
import { fetchStats, type FullStats } from "@/lib/api";

export function useStats(from: string, to: string) {
  const [data, setData] = useState<FullStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchStats(from, to)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [from, to]);

  return { data, loading, error };
}
