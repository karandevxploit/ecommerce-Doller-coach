import { useEffect, useState } from "react";
import { LogOut, Menu, User, Bell, Search, Settings } from "lucide-react";
import { api } from "../../api/client";

export default function Topbar({ onMenuClick }) {
  const adminUser = JSON.parse(localStorage.getItem("adminUser") || "null");
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get("/admin/notifications");
        if (!cancelled) setNotes(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    window.location.href = "/admin/login";
  };

  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <header className="sticky top-0 z-[50] bg-white/80 backdrop-blur-md border-b border-[#e2e8f0]">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg w-full max-w-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search purchases, customers..."
              className="bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-400 w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="relative group">
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors relative"
              title="Notifications"
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-80 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-[60] p-2">
              {notes.length === 0 ? (
                <p className="text-xs text-gray-500 p-2">No notifications yet.</p>
              ) : (
                notes.slice(0, 20).map((n) => (
                  <div key={n._id} className="text-xs p-2 rounded hover:bg-gray-50 border-b border-gray-50 last:border-0">
                    <p className="font-semibold text-gray-900">{n.title}</p>
                    <p className="text-gray-600 mt-0.5">{n.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <button type="button" className="hidden sm:block p-2 text-gray-400 hover:text-gray-900 transition-colors">
            <Settings size={18} />
          </button>

          <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1" />

          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <div className="text-sm font-semibold text-gray-900">{adminUser?.name || "Admin"}</div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              {adminUser?.name?.[0]?.toUpperCase() || <User size={16} />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="hidden sm:block p-2 text-gray-400 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
