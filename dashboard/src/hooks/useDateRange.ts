import { useState, useCallback } from "react";
import { daysAgo, today } from "@/lib/utils";

const STORAGE_KEY = "aulite_date_range";

function loadRange(): { from: string; to: string } {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return { from: daysAgo(30), to: today() };
}

export function useDateRange() {
  const [range, setRangeState] = useState(loadRange);

  const setRange = useCallback((from: string, to: string) => {
    const next = { from, to };
    setRangeState(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  return { from: range.from, to: range.to, setRange };
}
