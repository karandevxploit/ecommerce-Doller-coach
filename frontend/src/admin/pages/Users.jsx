import { useState, useEffect, useCallback, useMemo } from "react";
import { api, isCancelledRequest } from "../../api/client";
import { mapUser } from "../../api/dynamicMapper";
import toast from "react-hot-toast";
import {
  Search,
  User as UserIcon,
  ShieldCheck,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import Button from "../../components/ui/Button";

const getUserList = (responseData) => {
  const payload = responseData?.data || responseData || {};

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.items)) return payload.items;

  return [];
};

const isCancelError = (err) => {
  return (
    isCancelledRequest?.(err) ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
};

const formatDate = (value) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
};

const normalizeUser = (raw, index) => {
  const mapped = mapUser(raw || {});
  const id = String(raw?._id || raw?.id || mapped?.id || `user-${index}`);

  return {
    ...mapped,
    raw,
    id,
    name: mapped?.name || raw?.name || raw?.fullName || "User",
    email: mapped?.email || raw?.email || "",
    role: mapped?.role || raw?.role || "user",
    createdAt: mapped?.createdAt || raw?.createdAt || raw?.updatedAt || null,
  };
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async (signal) => {
    try {
      setLoading(true);

      const res = await api.get("/admin/users", { signal });
      const rawUsers = getUserList(res?.data);

      const mapped = rawUsers
        .map((item, index) => normalizeUser(item, index))
        .filter((user) => String(user.role || "").toLowerCase() !== "admin");

      const uniqueUsers = Array.from(new Map(mapped.map((user) => [user.id, user])).values());

      setUsers(uniqueUsers);
    } catch (err) {
      if (isCancelError(err)) return;

      console.error("USERS_FETCH_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Failed to load customers");
      setUsers([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);

    return () => controller.abort();
  }, [fetchUsers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim().toLowerCase());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return users;

    return users.filter((user) => {
      return (
        String(user?.name || "").toLowerCase().includes(debouncedSearch) ||
        String(user?.email || "").toLowerCase().includes(debouncedSearch)
      );
    });
  }, [users, debouncedSearch]);

  return (
    <div className="admin-shell">
      <div className="admin-card p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="admin-heading">Customers</h1>
          <p className="page-subtitle mt-1">
            Manage your customer base and permissions.
          </p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline">Export CSV</Button>
          <Button variant="primary">Add Customer</Button>
        </div>
      </div>

      <div className="admin-card p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="control-input w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>

        <Button variant="outline">
          <Filter size={16} /> Filter
        </Button>
      </div>

      <div className="admin-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state m-4">
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
              {filtered.map((user) => (
                <tr key={user.id} className="border-t">
                  <td className="px-6 py-4">
                    <div className="flex gap-3 items-center">
                      <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center font-bold">
                        {user.name?.[0]?.toUpperCase() || "U"}
                      </div>

                      <div>
                        <div className="font-medium text-gray-900 flex gap-1 items-center">
                          {user.name || "User"}
                          {String(user.role || "").toLowerCase() === "admin" && (
                            <ShieldCheck size={14} className="text-blue-600" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.email || "-"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-green-600 text-xs font-medium">
                      Active
                    </span>
                  </td>

                  <td className="px-6 py-4 capitalize">{user.role || "user"}</td>

                  <td className="px-6 py-4 text-xs text-gray-500">
                    {formatDate(user.createdAt)}
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
