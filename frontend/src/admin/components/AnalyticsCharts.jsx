import React, { memo, useId } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";
import { Info, TrendingUp, ShoppingBag } from "lucide-react";

const toSafeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSafeLabel = (value) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const formatShortLabel = (value) => {
  const label = toSafeLabel(value);
  return label.length > 8 ? `${label.slice(0, 8)}...` : label;
};

const formatCurrencyTick = (value) => {
  const amount = toSafeNumber(value);
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}K`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
};

const getOrderTicks = (data) => {
  const max = Math.max(...data.map((item) => toSafeNumber(item.orders)), 1);
  const ceiling = Math.ceil(max);
  if (ceiling <= 5) return Array.from({ length: ceiling + 1 }, (_, index) => index);
  return undefined;
};

const formatCurrency = (value) => {
  return `₹${toSafeNumber(value).toLocaleString("en-IN")}`;
};

const NoDataFallback = memo(({ title = "" }) => (
  <div className="flex flex-col items-center justify-center h-[300px] w-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
    <Info size={24} className="text-slate-300 mb-2" />
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
      No {title} data available
    </p>
  </div>
));

NoDataFallback.displayName = "NoDataFallback";

export const RevenueLineChart = memo(({ data }) => {
  const reactId = useId();
  const gradientId = `revenue-gradient-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const safeData = Array.isArray(data)
    ? data.map((item, index) => ({
      ...item,
      label: toSafeLabel(item?.label || `Item ${index + 1}`),
      revenue: toSafeNumber(item?.revenue),
    }))
    : [];

  const hasData = safeData.some((item) => item.revenue > 0);

  if (!safeData.length || !hasData) return <NoDataFallback title="revenue" />;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={14} className="text-blue-600" />
        <h3 className="text-[10px] font-black uppercase tracking-tighter">
          Revenue Trend
        </h3>
      </div>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
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
              tickFormatter={formatShortLabel}
              axisLine={false}
              tickLine={false}
              fontSize={10}
              fontWeight={600}
            />

            <YAxis
              tickFormatter={formatCurrencyTick}
              axisLine={false}
              tickLine={false}
              fontSize={10}
              fontWeight={600}
              width={52}
            />

            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={toSafeLabel}
              contentStyle={{ borderRadius: "12px", border: "none" }}
            />

            <Area
              type="linear"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={3}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

RevenueLineChart.displayName = "RevenueLineChart";

export const OrdersBarChart = memo(({ data }) => {
  const safeData = Array.isArray(data)
    ? data.map((item, index) => ({
      ...item,
      label: toSafeLabel(item?.label || `Item ${index + 1}`),
      orders: toSafeNumber(item?.orders),
    }))
    : [];

  const hasData = safeData.some((item) => item.orders > 0);
  const orderTicks = getOrderTicks(safeData);

  if (!safeData.length || !hasData) return <NoDataFallback title="orders" />;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag size={14} className="text-black" />
        <h3 className="text-[10px] font-black uppercase tracking-tighter">
          Orders Volume
        </h3>
      </div>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={safeData} margin={{ top: 10, right: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="label"
              tickFormatter={formatShortLabel}
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
              allowDecimals={false}
              ticks={orderTicks}
              domain={[0, (dataMax) => Math.max(1, Math.ceil(toSafeNumber(dataMax)))]}
            />

            <Tooltip
              formatter={(value) => toSafeNumber(value).toLocaleString("en-IN")}
              labelFormatter={toSafeLabel}
              contentStyle={{ borderRadius: "12px", border: "none" }}
            />

            <Bar
              dataKey="orders"
              fill="#000000"
              radius={[4, 4, 0, 0]}
              barSize={20}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

OrdersBarChart.displayName = "OrdersBarChart";
