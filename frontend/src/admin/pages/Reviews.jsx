import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { mapReview } from "../../api/dynamicMapper";
import {
  Check,
  Trash2,
  MessageSquare,
  Star,
  Search,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/Button";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ✅ STABLE FETCH (useCallback)
  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/reviews");
      const raw = res?.data;

      if (!Array.isArray(raw)) {
        setReviews([]);
        return;
      }

      const mapped = raw.map((r) => ({
        ...mapReview(r),
        id: r?._id || r?.id || Math.random().toString(36),
      }));

      setReviews(mapped);

    } catch (err) {
      console.error("REVIEWS ERROR:", err?.response?.data || err?.message);
      toast.error("Failed to load reviews");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // ✅ APPROVE (optimistic safe)
  const handleApprove = async (id) => {
    const prev = [...reviews];

    setReviews((p) =>
      p.map((r) => (r.id === id ? { ...r, status: "approved" } : r))
    );

    try {
      await api.put(`/reviews/admin/${id}/approve`);
      toast.success("Approved");
    } catch {
      setReviews(prev);
      toast.error("Approve failed");
    }
  };

  // ✅ DELETE (optimistic safe)
  const handleDelete = async (id) => {
    if (!window.confirm("Delete review?")) return;

    const prev = [...reviews];
    setReviews((p) => p.filter((r) => r.id !== id));

    try {
      await api.delete(`/reviews/admin/${id}`);
      toast.success("Deleted");
    } catch {
      setReviews(prev);
      toast.error("Delete failed");
    }
  };

  // ✅ SAFE FILTER (no crash)
  const filtered = reviews.filter((r) => {
    const q = search.toLowerCase();
    return (
      String(r?.user || "").toLowerCase().includes(q) ||
      String(r?.product || "").toLowerCase().includes(q) ||
      String(r?.comment || "").toLowerCase().includes(q)
    );
  });

  // ✅ SAFE DATE
  const formatDate = (d) => {
    const date = new Date(d);
    return isNaN(date) ? "—" : date.toLocaleDateString();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare size={20} /> Reviews
        </h1>

        <Button onClick={fetchReviews}>
          Refresh
        </Button>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews..."
          className="w-full pl-10 pr-4 py-2 border rounded"
        />
      </div>

      {/* LIST */}
      <div className="space-y-4">
        <AnimatePresence>

          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 animate-pulse rounded" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <AlertCircle size={40} className="mx-auto mb-2" />
              No reviews found
            </div>
          ) : (
            filtered.map((rev) => (
              <motion.div
                key={rev.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border p-4 rounded bg-white"
              >
                <div className="flex justify-between">

                  <div>
                    <h3 className="font-bold">{rev.user || "User"}</h3>

                    <p className="text-sm text-gray-500">
                      {formatDate(rev.createdAt)}
                    </p>

                    <p className="mt-2 text-gray-700">
                      {rev.comment || "No comment"}
                    </p>

                    <div className="flex mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          fill={rev.rating > i ? "#facc15" : "none"}
                          className={rev.rating > i ? "text-yellow-400" : "text-gray-300"}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {rev.status === "pending" && (
                      <button
                        onClick={() => handleApprove(rev.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded"
                      >
                        <Check size={14} /> Approve
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(rev.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>

                </div>
              </motion.div>
            ))
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}