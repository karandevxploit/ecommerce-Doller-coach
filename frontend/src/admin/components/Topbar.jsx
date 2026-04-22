import { useEffect, useState, useMemo, useRef } from "react";
import { LogOut, Menu, Bell, Search, Settings } from "lucide-react";
import { api } from "../../api/client";
import { useAuthStore } from "../../store";
import Avatar from "../../components/ui/Avatar";
import { useRealtime } from "../../hooks/useRealtime";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function Topbar({ onMenuClick }) {
  const { user: adminUser, logout } = useAuthStore();
  const [notes, setNotes] = useState([]);
  const navigate = useNavigate();
  const seenIds = useRef(new Set());

  // ✅ INITIAL LOAD FIX
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/admin/notifications");
        const data = res?.data || [];

        if (!cancelled) {
          setNotes(Array.isArray(data) ? data : []);
          data.forEach(n => seenIds.current.add(n._id));
        }
      } catch {
        if (!cancelled) setNotes([]);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ✅ REALTIME FIX
  const { socket } = useRealtime(true);

  useEffect(() => {
    if (!socket) return;

    const handleNewNote = (note) => {
      if (seenIds.current.has(note._id)) return;

      seenIds.current.add(note._id);
      setNotes((prev) => [note, ...prev]);

      toast.success(`Operational Alert: ${note.title}`, {
        id: `note-${note._id}`,
        icon: "🔔",
      });
    };

    socket.off("adminNotification"); // prevent duplicates
    socket.on("adminNotification", handleNewNote);

    return () => socket.off("adminNotification", handleNewNote);
  }, [socket]);

  // ✅ MEMOIZED unread count
  const unread = useMemo(
    () => notes.reduce((acc, n) => (!n.readAt ? acc + 1 : acc), 0),
    [notes]
  );

  // ✅ LOGOUT FIX
  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <header className="sticky top-0 z-[50] bg-white/80 backdrop-blur-md border-b border-[#e2e8f0]">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">

        {/* LEFT */}
        <div className="flex items-center gap-4 flex-1">
          <button onClick={onMenuClick} aria-label="Open Menu">
            <Menu size={20} />
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border rounded-lg w-full max-w-sm">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent outline-none w-full"
            />
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">

          {/* NOTIFICATIONS */}
          <div className="relative">
            <button aria-label="Notifications" className="relative">
              <Bell size={18} />
              {unread > 0 && (
                <span className="absolute top-0 right-0 text-xs bg-red-500 text-white px-1 rounded">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          </div>

          {/* SETTINGS */}
          <button aria-label="Settings">
            <Settings size={18} />
          </button>

          {/* USER */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block">{adminUser?.name || "Admin"}</span>

            <Avatar
              src={adminUser?.avatar}
              name={adminUser?.name}
              size="sm"
            />

            <button onClick={handleLogout} aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}