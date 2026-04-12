import { useState, useEffect, createElement, useCallback } from "react";
import { api } from "../../api/client";
import { DollarSign, ShoppingBag, Users as UsersIcon, RefreshCw, TrendingUp, BarChart3, Info, Lock, CheckCircle } from "lucide-react";
import Button from "../../components/ui/Button";
import { motion } from "framer-motion";
import { RevenueLineChart, OrdersBarChart } from "../components/AnalyticsCharts";

export default function Dashboard() {
  const [data, setData] = useState({
    metrics: { revenue: 0, orders: 0, customers: 0 },
    revenueTrend: [],
    ordersTrend: [],
    recentTransactions: [],
  });
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);

  // Synchronized Analytics Fetcher: Single stable endpoint strategy
  const refreshAnalytics = useCallback(async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      // Consolidating everything into /admin/stats ensures maximum reliability
      // even if the specialized trend routes are blocked or pending server restart.
      const res = await api.get("/admin/stats");

      setData({
        metrics: {
          revenue: res?.totalRevenue || 0,
          orders: res?.totalOrders || 0,
          customers: res?.totalUsers || 0,
        },
        revenueTrend: res?.revenueTrend || [],
        ordersTrend: res?.ordersTrend || [],
        recentTransactions: res?.recentTransactions || [],
      });
    } catch (err) {
      console.error("Dashboard Analytics Sync Error:", err);
      setErrorStatus(err.response?.status || 500);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAnalytics();
  }, [refreshAnalytics]);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-100 p-4 flex flex-1 items-center gap-3 transition-shadow hover:shadow-sm"
    >
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0 shadow-sm`}>
        {createElement(Icon, { size: 18, className: "text-white" })}
      </div>
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h3 className="text-lg font-black text-slate-900 tracking-tighter">
          {typeof value === "number" ? value.toLocaleString() : value}
        </h3>
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto p-4">
      
      {/* Precision Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Analytics <span className="text-blue-600">Overview</span></h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest -mt-0.5">Commercial Performance Heartbeat</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {errorStatus === 401 && (
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 border border-rose-100 rounded-lg mr-2">
                    <Lock size={10} className="text-rose-600" />
                    <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Auth Required</span>
                </div>
            )}
            <Button 
                variant="outline" 
                onClick={refreshAnalytics} 
                disabled={loading}
                className="h-8 rounded-lg px-4 border-slate-100 hover:bg-slate-50 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
            >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                {loading ? "Syncing..." : "Manual Sync"}
            </Button>
        </div>
      </div>

      {/* Top Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Total Revenue" 
          value={`₹${data.metrics.revenue}`} 
          icon={DollarSign} 
          color="bg-blue-600"
        />
        <StatCard 
          title="Orders Count" 
          value={data.metrics.orders} 
          icon={ShoppingBag} 
          color="bg-slate-900" 
        />
        <StatCard 
          title="Customer Base" 
          value={data.metrics.customers} 
          icon={UsersIcon} 
          color="bg-emerald-600" 
        />
      </div>

      {/* Unified Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <TrendingUp size={16} className="text-blue-600" />
               <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Revenue Velocity</h2>
            </div>
            <p className="text-[9px] font-bold text-rose-600 uppercase italic">Last 30 Days</p>
          </div>
          {loading ? (
             <div className="h-64 bg-slate-50 animate-pulse rounded-xl" />
          ) : (
            <RevenueLineChart data={data.revenueTrend} />
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
               <BarChart3 size={16} className="text-slate-900" />
               <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Order Distribution</h2>
            </div>
            <p className="text-[9px] font-bold text-rose-600 uppercase italic">Last 30 Days</p>
          </div>
          {loading ? (
             <div className="h-64 bg-slate-50 animate-pulse rounded-xl" />
          ) : (
            <OrdersBarChart data={data.ordersTrend} />
          )}
        </div>
      </div>

      {/* NEW: TRANSACTION LEDGER FOR TRANSPARENCY */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <CheckCircle size={20} className="text-emerald-600" />
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Real-Time Transaction Ledger</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Converting raw records to verified revenue</p>
                 </div>
              </div>
              <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse">
                 Live Feed
              </div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                      <tr>
                          <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Manifest ID</th>
                          <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Stakeholder</th>
                          <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                          <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Valuation</th>
                          <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Fiscal Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {data.recentTransactions?.length > 0 ? (
                        data.recentTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-6 py-4 text-[11px] font-black text-slate-900 uppercase">#{tx.id.slice(-8)}</td>
                              <td className="px-6 py-4 text-[11px] font-bold text-slate-600">{tx.customer}</td>
                              <td className="px-6 py-4 text-[11px] text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                              <td className="px-6 py-4 text-[11px] font-black text-slate-900">₹{tx.amount}</td>
                              <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${tx.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {tx.status}
                                  </span>
                              </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">No Recent Logs Found</td>
                        </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Stability Footer */}
      <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
          <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                <Info size={14} className="text-blue-600" />
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                <span className="font-black text-slate-900 uppercase tracking-tight mr-2">Sync Note:</span>
                Dashboard tracking the last 30 days of commercial operations with zero filtering restrictions.
              </p>
          </div>
          <button 
            onClick={() => window.location.href = "/admin/performance"} 
            className="text-[10px] font-black text-blue-600 hover:text-blue-500 uppercase tracking-widest transition-colors"
          >
            System Status &rarr;
          </button>
      </div>

    </div>
  );
}