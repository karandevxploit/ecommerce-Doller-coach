import { createElement, useEffect, lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useQuery } from "@tanstack/react-query";
import APIStateWrapper from "../../components/common/APIStateWrapper";
import { DollarSign, ShoppingBag, Users as UsersIcon, RefreshCw, Info } from "lucide-react";
import Button from "../../components/ui/Button";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store";

const RevenueLineChart = lazy(() =>
  import("../components/AnalyticsCharts").then((m) => ({ default: m.RevenueLineChart }))
);

const OrdersBarChart = lazy(() =>
  import("../components/AnalyticsCharts").then((m) => ({ default: m.OrdersBarChart }))
);

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeDashboardData = (raw) => {
  const data = raw?.data || raw || {};
  const metrics = data.metrics || {};

  return {
    ...data,
    revenue: safeNumber(data.revenue ?? metrics.revenue),
    orders: safeNumber(data.orders ?? metrics.orders),
    customers: safeNumber(data.customers ?? metrics.customers),
    revenueTrend: safeArray(data.revenueTrend),
    ordersTrend: safeArray(data.ordersTrend),
    recentTransactions: safeArray(data.recentTransactions),
  };
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdminAuthenticated } = useAuthStore();
  const [syncTimeout, setSyncTimeout] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      navigate("/admin/login", { replace: true });
    }
  }, [isAdminAuthenticated, navigate]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"],
    enabled: Boolean(isAdminAuthenticated),
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const res = await api.get("/admin/dashboard", { signal: controller.signal });
        return normalizeDashboardData(res?.data);
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    retry: 1,
  });

  useEffect(() => {
    let timer;

    if (isFetching) {
      setSyncTimeout(false);
      timer = setTimeout(() => {
        setSyncTimeout(true);
      }, 3000);
    } else {
      setSyncTimeout(false);
    }

    return () => clearTimeout(timer);
  }, [isFetching]);

  useEffect(() => {
    if (!isAdminAuthenticated) return;

    const interval = setInterval(() => {
      refetch();
    }, 60000);

    return () => clearInterval(interval);
  }, [isAdminAuthenticated, refetch]);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <motion.div className="admin-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center`}>
        {createElement(Icon, { size: 18, className: "text-white" })}
      </div>
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase">{title}</p>
        <h3 className="text-lg font-black text-slate-900">{value}</h3>
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

  const recentTransactions = safeArray(data?.recentTransactions);

  return (
    <div className="admin-shell min-h-screen">
      <div className="admin-card p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="admin-heading">Analytics Overview</h1>
          <p className="page-subtitle mt-1">Real-time performance monitoring and metrics</p>
        </div>

        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          className="bg-black hover:bg-slate-800 text-white shadow-xl shadow-slate-200 transition-all duration-300 active:scale-95"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          <span className="font-bold uppercase tracking-wider text-[10px]">
            {isFetching ? "Syncing..." : "Sync Data"}
          </span>
        </Button>
      </div>

      {syncTimeout && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 text-amber-700"
        >
          <Info size={16} />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            Slow connection detected. Fetching in progress...
          </p>
        </motion.div>
      )}

      <APIStateWrapper
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={<DashboardSkeleton />}
      >
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard title="Revenue" value={`₹${safeNumber(data.revenue).toLocaleString("en-IN")}`} icon={DollarSign} color="bg-indigo-600" />
              <StatCard title="Orders" value={safeNumber(data.orders).toLocaleString("en-IN")} icon={ShoppingBag} color="bg-slate-900" />
              <StatCard title="Customers" value={safeNumber(data.customers).toLocaleString("en-IN")} icon={UsersIcon} color="bg-emerald-600" />
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <div className="admin-card p-1">
                <Suspense fallback={<div className="h-80 bg-slate-50 animate-pulse rounded-xl" />}>
                  <RevenueLineChart data={data.revenueTrend} />
                </Suspense>
              </div>
              <div className="admin-card p-1">
                <Suspense fallback={<div className="h-80 bg-slate-50 animate-pulse rounded-xl" />}>
                  <OrdersBarChart data={data.ordersTrend} />
                </Suspense>
              </div>
            </div>

            <div className="admin-card overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex items-center gap-2">
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
                    {recentTransactions.length > 0 ? (
                      recentTransactions.map((tx, idx) => {
                        const id = tx?.id || tx?._id || `TX-${idx + 1}`;
                        const status = tx?.status || "PENDING";

                        return (
                          <motion.tr
                            key={id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="hover:bg-slate-50/80 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs font-bold text-slate-400">
                                #{String(id).slice(-6).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700 text-sm">{tx?.customer || "N/A"}</td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                              {tx?.createdAt
                                ? new Date(tx.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                : "-"}
                            </td>
                            <td className="px-6 py-4 font-black text-slate-900 text-sm">
                              ₹{safeNumber(tx?.amount).toLocaleString("en-IN")}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-tighter uppercase ${status === "DELIVERED"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : status === "CANCELLED"
                                      ? "bg-rose-50 text-rose-600"
                                      : "bg-amber-50 text-amber-600"
                                  }`}
                              >
                                {status}
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
