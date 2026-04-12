import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Info } from "lucide-react";

const NoDataFallback = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
    <Info size={24} className="text-slate-300 mb-2" />
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No {title} data available</p>
  </div>
);

export const RevenueLineChart = ({ data }) => {
  if (!data || data.length === 0) return <div style={{ height: 300, width: "100%" }}><NoDataFallback title="revenue" /></div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: '700', fill: "#94a3b8" }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: '700', fill: "#94a3b8" }} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '10px' }} 
            itemStyle={{ color: '#0f172a', fontWeight: '800', fontSize: '12px' }}
            labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}
          />
          <Area 
            type="monotone" 
            dataKey="revenue" 
            stroke="#3b82f6" 
            strokeWidth={3} 
            fillOpacity={1} 
            fill="url(#colorRev)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const OrdersBarChart = ({ data }) => {
  if (!data || data.length === 0) return <div style={{ height: 300, width: "100%" }}><NoDataFallback title="order" /></div>;

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: '700', fill: "#94a3b8" }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fontWeight: '700', fill: "#94a3b8" }} 
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '10px' }}
            itemStyle={{ color: '#0f172a', fontWeight: '800', fontSize: '12px' }}
            labelStyle={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 'bold' }}
          />
          <Bar 
            dataKey="orders" 
            fill="#0f172a" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={30} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
