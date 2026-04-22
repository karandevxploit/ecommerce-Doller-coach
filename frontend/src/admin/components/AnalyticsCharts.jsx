import React, { memo, useId } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar
} from "recharts";
import { Info, TrendingUp, ShoppingBag } from "lucide-react";

const NoDataFallback = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-[300px] w-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
    <Info size={24} className="text-slate-300 mb-2" />
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
      No {title} data available
    </p>
  </div>
);

export const RevenueLineChart = memo(({ data }) => {
  const gradientId = useId();

  const safeData = Array.isArray(data) ? data : [];

  if (!safeData.length) return <NoDataFallback title="revenue" />;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} className="text-blue-600" />
        <h3 className="text-[10px] font-black uppercase tracking-tighter">Revenue Trend</h3>
      </div>
      
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={safeData} margin={{ top: 10, right: 10, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="label"
              tickFormatter={(v) => (v?.length > 8 ? v.slice(0, 8) + "…" : v)}
              axisLine={false}
              tickLine={false}
              fontSize={10}
              fontWeight={600}
            />

            <YAxis
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
              axisLine={false}
              tickLine={false}
              fontSize={10}
              fontWeight={600}
            />

            <Tooltip
              formatter={(v) => `₹${Number(v).toLocaleString()}`}
              contentStyle={{ borderRadius: "12px", border: "none" }}
            />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={3}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export const OrdersBarChart = memo(({ data }) => {
  const safeData = Array.isArray(data) ? data : [];

  if (!safeData.length) return <NoDataFallback title="orders" />;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag size={14} className="text-black" />
        <h3 className="text-[10px] font-black uppercase tracking-tighter">Orders Volume</h3>
      </div>

      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={safeData} margin={{ top: 10, right: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="label"
              tickFormatter={(v) => (v?.length > 8 ? v.slice(0, 8) + "…" : v)}
              axisLine={false}
              tickLine={false}
              fontSize={10}
              fontWeight={600}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              fontSize={10}
              fontWeight={600}
            />

            <Tooltip
              contentStyle={{ borderRadius: "12px", border: "none" }}
            />

            <Bar
              dataKey="orders"
              fill="#000000"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});