import { Lock } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import type { ReactNode } from "react";

export function ProGate({ page, children }: { page: string; children: ReactNode }) {
  const { pages, loading } = usePlan();

  if (loading) return null;

  const locked = !pages.includes(page);

  if (!locked) return <>{children}</>;

  return (
    <div className="relative h-[calc(100vh-3rem)] lg:h-screen overflow-hidden">
      <div className="pointer-events-none select-none blur-[6px] opacity-50">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-8 max-w-sm text-center mx-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Lock size={20} className="text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Upgrade to Pro</h2>
          <p className="text-sm text-gray-500 mb-5">
            This page is available on the Aulite Pro plan. Add your license key to unlock all features.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-left">
            <p className="text-xs text-gray-400 mb-1.5">Add to your .env file:</p>
            <code className="text-xs font-mono text-gray-700">AULITE_LICENSE_KEY=aulite_pro_...</code>
            <p className="text-xs text-gray-400 mt-2">Then restart the server.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
