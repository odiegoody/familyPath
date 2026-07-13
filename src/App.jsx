import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { seedIfEmpty } from "./db/db";
import BottomNav from "./components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import AddTransaction from "./pages/AddTransaction";
import Budget from "./pages/Budget";
import Goals from "./pages/Goals";
import AddGoal from "./pages/AddGoal";
import GoalDetail from "./pages/GoalDetail";
import Assets from "./pages/Assets";
import AddAsset from "./pages/AddAsset";
import AssetDetail from "./pages/AssetDetail";
import More from "./pages/More";
import Liabilities from "./pages/Liabilities";
import AddLiability from "./pages/AddLiability";
import LiabilityDetail from "./pages/LiabilityDetail";
import Members from "./pages/Members";
import Categories from "./pages/Categories";
import AddCategory from "./pages/AddCategory";
import Investments from "./pages/Investments";
import AddInvestment from "./pages/AddInvestment";
import InvestmentDetail from "./pages/InvestmentDetail";
import Backup from "./pages/Backup";

function Layout() {
  const location = useLocation();
  const hideNav =
    location.pathname.startsWith("/tambah") ||
    location.pathname === "/goals/baru" ||
    location.pathname === "/aset/baru" ||
    location.pathname === "/hutang/baru" ||
    location.pathname === "/kategori/baru" ||
    location.pathname === "/investasi/baru" ||
    location.pathname.endsWith("/edit");

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transaksi" element={<Transactions />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/goals/baru" element={<AddGoal />} />
        <Route path="/goals/:id" element={<GoalDetail />} />
        <Route path="/goals/:id/edit" element={<AddGoal />} />
        <Route path="/aset" element={<Assets />} />
        <Route path="/aset/baru" element={<AddAsset />} />
        <Route path="/aset/:id" element={<AssetDetail />} />
        <Route path="/aset/:id/edit" element={<AddAsset />} />
        <Route path="/lainnya" element={<More />} />
        <Route path="/hutang" element={<Liabilities />} />
        <Route path="/hutang/baru" element={<AddLiability />} />
        <Route path="/hutang/:id" element={<LiabilityDetail />} />
        <Route path="/hutang/:id/edit" element={<AddLiability />} />
        <Route path="/anggota" element={<Members />} />
        <Route path="/kategori" element={<Categories />} />
        <Route path="/kategori/baru" element={<AddCategory />} />
        <Route path="/kategori/:id/edit" element={<AddCategory />} />
        <Route path="/investasi" element={<Investments />} />
        <Route path="/investasi/baru" element={<AddInvestment />} />
        <Route path="/investasi/:id" element={<InvestmentDetail />} />
        <Route path="/investasi/:id/edit" element={<AddInvestment />} />
        <Route path="/backup" element={<Backup />} />
        <Route path="/tambah" element={<AddTransaction />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedIfEmpty().then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-surface" />;
  }

  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  );
}
