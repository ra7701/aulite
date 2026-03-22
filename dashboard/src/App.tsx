import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProGate } from "@/components/ProGate";
import { Overview } from "@/pages/Overview";
import { Requests } from "@/pages/Requests";
import { Compliance } from "@/pages/Compliance";
import { Reports } from "@/pages/Reports";
import { SettingsPage } from "@/pages/SettingsPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="requests" element={<Requests />} />
        <Route path="compliance" element={<ProGate page="compliance"><Compliance /></ProGate>} />
        <Route path="reports" element={<ProGate page="reports"><Reports /></ProGate>} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
