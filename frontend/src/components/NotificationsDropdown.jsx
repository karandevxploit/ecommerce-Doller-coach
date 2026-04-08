import { useState, useRef, useEffect } from "react";
import { Bell, CheckCircle2, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationsDropdown() {
  void motion;
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.get("/notifications/my");
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/read/${id}`);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      );
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-10 w-10 flex items-center justify-center rounded-lg bg-[#f1f5f9] border border-gray-100 text-[#0f172a]/60 hover:text-[#0f172a] hover:bg-[#F2F2F2] transition-all"
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 h-2 w-2 bg-[#1e3a8a] rounded-full shadow-sm" />
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute right-0 mt-3 w-80 md:w-96 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-[100]"
          >
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-[11px] font-black text-[#0f172a] uppercase tracking-widest">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-4 py-2 text-sm rounded-lg bg-[#0f172a] text-white hover:scale-[1.02] shadow-sm transition-all">
                  {unreadCount} NEW
                </span>
              )}
            </div>

            {/* Body */}
            <div className="max-h-[400px] overflow-y-auto">

              {loading ? (
                <div className="p-10 flex justify-center">
                  <div className="h-6 w-6 border-2 border-gray-200 border-t-black animate-spin rounded-full" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 text-center text-gray-400">
                  <Inbox size={32} className="mx-auto mb-3" />
                  No notifications
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => markAsRead(n._id)}
                      className={`px-5 py-4 cursor-pointer transition-all ${
                        !n.readAt
                          ? "bg-[#1e3a8a]/5 hover:bg-[#1e3a8a]/10 border-l-2 border-[#1e3a8a]"
                          : "hover:bg-[#f1f5f9] border-l-2 border-transparent"
                      }`}
                    >
                      <p className={`text-[11px] font-black uppercase tracking-tight ${!n.readAt ? "text-[#0f172a]" : "text-gray-400"}`}>
                        {n.title}
                      </p>
                      <p className="text-[9px] text-gray-400 font-medium mt-1 line-clamp-2 uppercase tracking-wide">
                        {n.body}
                      </p>
                      <p className="text-[8px] text-gray-300 font-black mt-2 uppercase tracking-widest">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <button
              onClick={async () => {
                try {
                  await api.post("/notifications/read/all");
                  setNotifications((prev) =>
                    prev.map((n) => ({
                      ...n,
                      readAt: new Date().toISOString(),
                    }))
                  );
                  toast.success("Iduser Saveed");
                } catch {
                  toast.error("Save Failed");
                }
              }}
              disabled={unreadCount === 0}
              className="w-full py-3 text-[10px] font-black text-[#0f172a] uppercase tracking-widest hover:bg-[#1e3a8a] transition-all disabled:opacity-30 border-t border-gray-100"
            >
              Clear All Updates
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}