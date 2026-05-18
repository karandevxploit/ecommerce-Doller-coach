import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bell, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { api, isCancelledRequest } from "../api/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const getNotificationList = (responseData) => {
  const payload = responseData?.data || responseData || {};

  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.notifications)) return payload.notifications;
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

const normalizeNotification = (item, index) => ({
  ...item,
  _id: item?._id || item?.id || `notification-${index}`,
  title: item?.title || "Update",
  body: item?.body || item?.message || "",
  readAt: item?.readAt || item?.read_at || null,
  createdAt: item?.createdAt || item?.created_at || item?.updatedAt || null,
});

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
};

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const dropdownRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const fetchNotifications = useCallback(async (signal) => {
    try {
      setLoading(true);

      const res = await api.get("/notifications/my", { signal });
      const list = getNotificationList(res?.data).map(normalizeNotification);

      setNotifications(list);
    } catch (err) {
      if (isCancelError(err)) return;

      console.error("NOTIFICATIONS_FETCH_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Unable to load notifications");
      setNotifications([]);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    fetchNotifications(controller.signal);

    return () => controller.abort();
  }, [isOpen, fetchNotifications]);

  const unreadCount = useMemo(() => {
    return notifications.reduce((count, item) => (!item?.readAt ? count + 1 : count), 0);
  }, [notifications]);

  const markAsRead = async (id) => {
    if (!id || busy) return;

    const previous = notifications;

    setNotifications((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, readAt: new Date().toISOString() } : item
      )
    );

    try {
      setBusy(true);
      await api.post(`/notifications/read/${encodeURIComponent(id)}`);
    } catch (err) {
      console.error("NOTIFICATION_READ_ERROR:", err?.response?.data || err?.message);
      setNotifications(previous);
      toast.error(err?.response?.data?.message || "Could not update notification");
    } finally {
      setBusy(false);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0 || busy) return;

    const previous = notifications;
    const now = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        readAt: item.readAt || now,
      }))
    );

    try {
      setBusy(true);
      await api.post("/notifications/read/all");
      toast.success("All notifications cleared");
    } catch (err) {
      console.error("NOTIFICATIONS_READ_ALL_ERROR:", err?.response?.data || err?.message);
      setNotifications(previous);
      toast.error(err?.response?.data?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        aria-expanded={isOpen}
        className="relative h-10 w-10 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition"
      >
        <Bell size={18} />

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-indigo-600 rounded-full" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 mt-3 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-[100]"
          >
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
                  {notifications.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      disabled={busy}
                      onClick={() => markAsRead(item._id)}
                      className={`w-full text-left px-4 py-3 transition disabled:opacity-70 ${!item.readAt
                          ? "bg-indigo-50 hover:bg-indigo-100"
                          : "hover:bg-slate-50"
                        }`}
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {item.title || "Update"}
                      </p>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {item.body || ""}
                      </p>

                      <p className="text-[10px] text-slate-400 mt-1">
                        {formatDate(item.createdAt)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0 || busy}
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
