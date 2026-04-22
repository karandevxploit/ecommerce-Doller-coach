import { createElement, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useQuery } from "@tanstack/react-query";
import APIStateWrapper from "../../components/common/APIStateWrapper";
import {
  DollarSign, ShoppingBag, Users as UsersIcon,
  RefreshCw, TrendingUp, BarChart3, Info, Lock, CheckCircle
} from "lucide-react";
import Button from "../../components/ui/Button";
import { motion } from "framer-motion";
import { RevenueLineChart, OrdersBarChart } from "../components/AnalyticsCharts";
import { useRealtime } from "../../hooks/useRealtime";
import { useAuthStore } from "../../store";
import toast from "react-hot-toast";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdminAuthenticated } = useAuthStore();
  const { socket } = useRealtime(true);

  // 🛡️ SECURITY LOCK
  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate("/admin/login");
    }
  }, [isAdminAuthenticated, navigate]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      console.log("[DASHBOARD] Fetching stats...");
      const res = await api.get("/admin/stats");
      
      // 🛡️ MAPPING FIX: Extract data from backend envelope
      const d = res?.data?.data || res?.data || {};
      console.log("Dashboard API Response:", d);

      return {
        metrics: {
          revenue: d.totalRevenue || 0,
          orders: d.totalOrders || 0,
          customers: d.totalUsers || 0,
        },
        revenueTrend: Array.isArray(d.revenueTrend) ? d.revenueTrend : [],
        ordersTrend: Array.isArray(d.ordersTrend) ? d.ordersTrend : [],
        recentTransactions: Array.isArray(d.recentTransactions) ? d.recentTransactions : [],
      };
    },
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
  });

  // ✅ SOCKET FIX
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (payload) => {
      refetch();

      if (payload?.id) {
        toast.success(`Order #${payload.id.slice(-6)} updated`, {
          id: `order-${payload.id}`,
        });
      }
    };

    socket.off("orderUpdated");
    socket.off("userRegistered");

    socket.on("orderUpdated", handleUpdate);
    socket.on("userRegistered", handleUpdate);

    return () => {
      socket.off("orderUpdated", handleUpdate);
      socket.off("userRegistered", handleUpdate);
    };
  }, [socket, refetch]);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <motion.div className="bg-white rounded-xl border p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
        {createElement(Icon, { size: 18, className: "text-white" })}
      </div>
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase">{title}</p>
        <h3 className="text-lg font-black text-slate-900">
          {typeof value === "number" ? value.toLocaleString() : value}
        </h3>
      </div>
    </motion.div>
  );

  const DashboardSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="grid md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-50 rounded-xl border border-gray-100" />
        <div className="h-64 bg-gray-50 rounded-xl border border-gray-100" />
      </div>
      <div className="h-96 bg-gray-50 rounded-xl border border-gray-100" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 min-h-screen">
      
      {/* 🚀 PREMIUM HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics Overview</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Real-time performance monitoring and metrics</p>
        </div>

        <Button 
          onClick={refetch} 
          disabled={isFetching}
          className="bg-black hover:bg-slate-800 text-white shadow-xl shadow-slate-200 transition-all duration-300 active:scale-95"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          <span className="font-bold uppercase tracking-wider text-[10px]">
            {isFetching ? "Syncing..." : "Sync Data"}
          </span>
        </Button>
      </div>

      <APIStateWrapper 
        isLoading={isLoading} 
        isError={isError} 
        error={error} 
        onRetry={refetch}
        loadingFallback={<DashboardSkeleton />}
      >
        {data && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-8"
          >
            {/* METRICS */}
            <div className="grid md:grid-cols-3 gap-6">
              <StatCard title="Revenue" value={`₹${data.metrics.revenue.toLocaleString()}`} icon={DollarSign} color="bg-indigo-600" />
              <StatCard title="Orders" value={data.metrics.orders} icon={ShoppingBag} color="bg-slate-900" />
              <StatCard title="Customers" value={data.metrics.customers} icon={UsersIcon} color="bg-emerald-600" />
            </div>

            {/* CHARTS */}
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-white shadow-sm">
                <RevenueLineChart data={data.revenueTrend} />
              </div>
              <div className="bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-white shadow-sm">
                <OrdersBarChart data={data.ordersTrend} />
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest">Recent Transactions</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-50">
                    {data.recentTransactions.length > 0 ? (
                      data.recentTransactions.map((tx, idx) => {
                        const id = tx.id || tx._id;

                        return (
                          <motion.tr 
                            key={id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs font-bold text-slate-400">#{String(id).slice(-6).toUpperCase()}</span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700 text-sm">{tx.customer || "N/A"}</td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                              {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : "—"}
                            </td>
                            <td className="px-6 py-4 font-black text-slate-900 text-sm">₹{Number(tx.amount || 0).toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-tighter uppercase
                                ${tx.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' : 
                                  tx.status === 'CANCELLED' ? 'bg-rose-50 text-rose-600' : 
                                  'bg-amber-50 text-amber-600'}`}>
                                {tx.status || "PENDING"}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-20 text-center text-slate-400 font-medium">
                          No recent transactions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </APIStateWrapper>
    </div>
  );
}