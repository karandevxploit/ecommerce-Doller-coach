import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  /* ---------------- CLICK OUTSIDE ---------------- */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---------------- FETCH ---------------- */
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/notifications/my");
      const safe = Array.isArray(data) ? data : data?.notifications || [];
      setNotifications(safe);
    } catch {
      toast.error("Unable to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  /* ---------------- DERIVED ---------------- */
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  /* ---------------- ACTIONS ---------------- */
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
      toast.error("Could not update notification");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/notifications/read/all");
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: new Date().toISOString()
        }))
      );
      toast.success("All notifications cleared");
    } catch {
      toast.error("Action failed");
    }
  };

  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bell */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        className="relative h-10 w-10 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-indigo-600 rounded-full" />
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 mt-3 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-[100]"
          >

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-900">
                Notifications
              </h3>

              {unreadCount > 0 && (
                <span className="text-xs text-indigo-600 font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* Body */}
            <div className="max-h-[400px] overflow-y-auto">

              {loading ? (
                <div className="p-8 flex justify-center">
                  <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-900 animate-spin rounded-full" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Inbox size={28} className="mx-auto mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => markAsRead(n._id)}
                      className={`w-full text-left px-4 py-3 transition ${!n.readAt
                          ? "bg-indigo-50 hover:bg-indigo-100"
                          : "hover:bg-slate-50"
                        }`}
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {n.title || "Update"}
                      </p>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {n.body || ""}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatDate(n.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <button
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="w-full py-3 text-sm font-medium text-slate-700 border-t border-slate-100 hover:bg-slate-50 disabled:opacity-40"
            >
              Mark all as read
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}