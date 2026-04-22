import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { mapUser } from "../../api/dynamicMapper";
import toast from "react-hot-toast";
import {
  Search,
  User as UserIcon,
  ShieldCheck,
  Filter,
  MoreHorizontal
} from "lucide-react";
import Button from "../../components/ui/Button";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ✅ SAFE FETCH
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/users");
      
      // ✅ FIX: Unwrap standard API envelope ({ success: true, data: [...] })
      const raw = res?.data?.data || res?.data?.users || res?.data;

      if (!raw || !Array.isArray(raw)) {
        setUsers([]);
        setFiltered([]);
        return;
      }

      const mapped = raw
        .map((u) => ({
          ...mapUser(u),
          id: u?._id || u?.id,
        }))
        .filter((u) => u.role !== "admin"); // safeguard

      setUsers(mapped);
      setFiltered(mapped);

    } catch (err) {
      console.error("USERS FETCH ERROR:", err?.response?.data || err?.message);
      toast.error("Failed to load customers");
      setUsers([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ✅ SAFE SEARCH (debounced feel)
  useEffect(() => {
    const timer = setTimeout(() => {
      const q = search.toLowerCase();

      const result = users.filter((u) => {
        return (
          String(u?.name || "").toLowerCase().includes(q) ||
          String(u?.email || "").toLowerCase().includes(q)
        );
      });

      setFiltered(result);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, users]);

  // ✅ SAFE DATE FORMAT
  const formatDate = (d) => {
    const date = new Date(d);
    return isNaN(date)
      ? "—"
      : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  };

  return (
    <div className="space-y-6 pt-4">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your customer base and permissions.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline">Export CSV</Button>
          <Button variant="primary">Add Customer</Button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 text-sm outline-none"
          />
        </div>

        <Button variant="outline">
          <Filter size={16} /> Filter
        </Button>
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <UserIcon size={30} className="mx-auto mb-2" />
            No customers found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((u) => (
                <tr key={u.id || Math.random()} className="border-t">

                  <td className="px-6 py-4">
                    <div className="flex gap-3 items-center">
                      <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center font-bold">
                        {u.name?.[0]?.toUpperCase() || "U"}
                      </div>

                      <div>
                        <div className="font-medium text-gray-900 flex gap-1 items-center">
                          {u.name || "User"}
                          {u.role === "admin" && (
                            <ShieldCheck size={14} className="text-blue-600" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {u.email || "—"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-green-600 text-xs font-medium">
                      Active
                    </span>
                  </td>

                  <td className="px-6 py-4 capitalize">
                    {u.role || "user"}
                  </td>

                  <td className="px-6 py-4 text-xs text-gray-500">
                    {formatDate(u.createdAt)}
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
        )}

      </div>
    </div>
  );
}