import { useState, useEffect, createElement } from "react";
import { api } from "../../api/client";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingBag, Users as UsersIcon, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get("/admin/stats");
        setStats(res || null);
      } catch (err) {
        toast.error("Analytics fetch failed");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-1/4 bg-gray-200 rounded-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1,2,3].map((i) => <div key={i} className="h-32 bg-white rounded-xl border border-gray-100" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
           <div className="h-80 bg-white rounded-xl border border-gray-100" />
           <div className="h-80 bg-white rounded-xl border border-gray-100" />
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend, isPositive }) => (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{trend}</span>
            <span className="text-gray-400 ml-1">vs last month</span>
          </div>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          {createElement(Icon, { size: 20 })}
        </div>
      </div>
    </div>
  );

  const handleDownloadReport = async () => {
    try {
      toast.loading("Generating report...", { id: "export" });
      const response = await api.get("/admin/orders/export", { responseType: "blob" });
      
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `orders_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success("Report downloaded", { id: "export" });
    } catch (err) {
      toast.error("Export failure", { id: "export" });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Here's what's happening with your store today.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleDownloadReport}>
            Download Report
          </Button>
          <Button variant="primary">
            <Activity size={16} /> Manage Analytics
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard 
          title="Total Revenue" 
          value={`₹${Math.floor(stats?.totalRevenue || 0).toLocaleString()}`} 
          icon={DollarSign} 
          trend="12.5%" 
          isPositive={true} 
        />
        <StatCard 
          title="Active Orders" 
          value={stats?.totalOrders || 0} 
          icon={ShoppingBag} 
          trend="8.2%" 
          isPositive={true} 
        />
        <StatCard 
          title="Total Customers" 
          value={stats?.totalUsers || 0} 
          icon={UsersIcon} 
          trend="2.4%" 
          isPositive={false} 
        />
      </div>

      {/* Charts Layer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Revenue Area Chart */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-gray-900">Revenue Performance</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.revenueData || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  itemStyle={{ color: '#0f172a', fontWeight: '600' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Bar Chart */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-gray-900">Order Volume</h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.orderData || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: '600' }}
                />
                <Bar dataKey="orders" fill="#0f172a" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}