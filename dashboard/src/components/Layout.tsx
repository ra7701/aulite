import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, List, Shield, FileText, Settings, Menu, X, Lock } from "lucide-react";
import { PlanCtx, usePlanLoader } from "@/hooks/usePlan";

const NAV = [
  { to: "/", slug: "overview", icon: LayoutDashboard, label: "Overview" },
  { to: "/requests", slug: "requests", icon: List, label: "Requests" },
  { to: "/compliance", slug: "compliance", icon: Shield, label: "Compliance" },
  { to: "/reports", slug: "reports", icon: FileText, label: "Reports" },
  { to: "/settings", slug: "settings", icon: Settings, label: "Settings" },
];

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const planCtx = usePlanLoader();

  return (
    <PlanCtx.Provider value={planCtx}>
      <div className="flex h-screen">
        <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between bg-gray-900 px-4 py-3 lg:hidden">
          <img src="/sidebar-aulite.svg" alt="Aulite" className="h-5" />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-300 p-1">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        <nav
          className={`
            fixed inset-y-0 left-0 z-40 w-56 bg-gray-900 text-gray-300 flex flex-col shrink-0
            transform transition-transform duration-200 ease-in-out
            lg:static lg:translate-x-0
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="px-4 py-5 flex items-center gap-2">
            <img src="/sidebar-aulite.svg" alt="Aulite" className="h-6" />
            {!planCtx.loading && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                planCtx.plan === "pro"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-700 text-gray-400"
              }`}>
                {planCtx.plan.toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 px-3 py-2 space-y-0.5">
            {NAV.map(({ to, slug, icon: Icon, label }) => {
              const locked = !planCtx.loading && !planCtx.pages.includes(slug);
              return (
                <NavLink
                  key={to}
                  to={locked ? "#" : to}
                  end={to === "/"}
                  onClick={(e) => {
                    if (locked) e.preventDefault();
                    else setMobileOpen(false);
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      locked
                        ? "text-gray-600 cursor-not-allowed"
                        : isActive
                          ? "bg-gray-800 text-white"
                          : "hover:bg-gray-800/50 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {locked && <Lock size={12} className="text-gray-600" />}
                </NavLink>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
            Regulation (EU) 2024/1689
          </div>
        </nav>

        <main className="flex-1 overflow-auto pt-12 lg:pt-0">
          <Outlet />
        </main>
      </div>
    </PlanCtx.Provider>
  );
}
