import { createContext, useContext, useEffect, useState } from "react";
import { fetchHealth } from "@/lib/api";

interface PlanContext {
  plan: string;
  pages: string[];
  loading: boolean;
}

const defaultCtx: PlanContext = { plan: "free", pages: ["overview", "requests"], loading: true };
export const PlanCtx = createContext<PlanContext>(defaultCtx);

export function usePlan() {
  return useContext(PlanCtx);
}

export function usePlanLoader(): PlanContext {
  const [ctx, setCtx] = useState<PlanContext>(defaultCtx);

  useEffect(() => {
    fetchHealth()
      .then((h) => setCtx({
        plan: h.plan ?? "free",
        pages: h.dashboardPages ?? ["overview", "requests"],
        loading: false,
      }))
      .catch(() => setCtx({ ...defaultCtx, loading: false }));
  }, []);

  return ctx;
}
