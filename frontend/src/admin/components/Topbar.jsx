import { useEffect, useState, useMemo } from "react";
import { LogOut, Menu, Bell, Search, Settings } from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../store";
import Avatar from "../../components/ui/Avatar";
import { useNavigate } from "react-router-dom";

const getNotificationList = (responseData) => {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.notifications)) return responseData.notifications;
  return [];
};

export default function Topbar({ onMenuClick }) {
  const { user: adminUser, logout } = useAuthStore();
  const [notes, setNotes] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchNotifications = async () => {
      try {
        const res = await api.get("/admin/notifications");
        const list = getNotificationList(res?.data);

        if (!cancelled) {
          setNotes(list);
        }
      } catch (error) {
        if (!cancelled) {
          setNotes([]);
        }
      }
    };

    fetchNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  const unread = useMemo(() => {
    return notes.reduce((acc, note) => {
      return !note?.readAt ? acc + 1 : acc;
    }, 0);
  }, [notes]);

  const handleLogout = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };

  const handleSettingsClick = () => {
    navigate("/admin/settings");
  };

  return (
    <header className="sticky top-0 z-[50] bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="flex h-[60px] items-center justify-between px-4 md:px-6 lg:px-8">
        {/* LEFT */}
        <div className="flex items-center gap-4 flex-1">
          <button type="button" onClick={onMenuClick} aria-label="Open Menu" className="icon-button !border-transparent lg:hidden">
            <Menu size={20} />
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 bg-slate-50 border border-slate-200 rounded-lg h-10 w-full max-w-sm">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent outline-none w-full text-sm font-semibold placeholder:text-slate-400 border-none focus:ring-0"
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">
          {/* NOTIFICATIONS */}
          <div className="relative">
            <button type="button" aria-label="Notifications" className="icon-button !border-transparent relative">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-0 right-0 text-xs bg-red-500 text-white px-1 rounded">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>

          {/* SETTINGS */}
          <button type="button" aria-label="Settings" onClick={handleSettingsClick} className="icon-button !border-transparent">
            <Settings size={18} />
          </button>

          {/* USER */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <span className="hidden md:block text-sm font-bold text-slate-700">{adminUser?.name || "Admin"}</span>

            <Avatar src={adminUser?.avatar} name={adminUser?.name || "Admin"} size="sm" />

            <button type="button" onClick={handleLogout} aria-label="Logout" className="icon-button !border-transparent">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
