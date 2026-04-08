import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { mapUser } from "../../api/dynamicMapper";
import toast from "react-hot-toast";
import { Search, User as UserIcon, ShieldCheck, Mail, Calendar, Filter, Sparkles, ArrowRight, Activity, Zap, CheckCircle, MoreHorizontal } from "lucide-react";
import Button from "../../components/ui/Button";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/users");
      const data = res.data || res.users || res || [];
      const mapped = Array.isArray(data) ? data.map(mapUser) : [];
      setUsers(mapped);
      setFiltered(mapped);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      users.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      )
    );
  }, [search, users]);

  return (
    <div className="space-y-6 mt-0 pt-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your customer base and permissions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline">
            Export CSV
          </Button>
          <Button variant="primary">
            Add Customer
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full sm:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            placeholder="Search customers by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-400"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
           <Button variant="outline" className="flex-1 sm:flex-none">
              <Filter size={16} /> Filter
           </Button>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
           <div className="divide-y divide-gray-100">
             {[1,2,3,4,5].map((i) => (
               <div key={i} className="p-4 flex items-center gap-4 animate-pulse">
                 <div className="h-10 w-10 bg-gray-100 rounded-full" />
                 <div className="space-y-2 flex-1">
                   <div className="h-4 w-32 bg-gray-100 rounded" />
                   <div className="h-3 w-48 bg-gray-50 rounded" />
                 </div>
               </div>
             ))}
           </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
             <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
               <UserIcon size={24} className="text-gray-400" />
             </div>
             <h3 className="text-sm font-medium text-gray-900">No customers found</h3>
             <p className="text-sm text-gray-500 mt-1">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-200 uppercase font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-4">Customer</th>
                  <th scope="col" className="px-6 py-4">Status</th>
                  <th scope="col" className="px-6 py-4">Role</th>
                  <th scope="col" className="px-6 py-4">Joined</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-1.5">
                            {u.name}
                            {u.role === "admin" && <ShieldCheck size={14} className="text-blue-600" />}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600 capitalize">{u.role || "User"}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(u.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="icon">
                        <MoreHorizontal size={18} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}