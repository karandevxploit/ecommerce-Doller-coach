import { useState, useEffect, useCallback, useMemo } from "react";
import { api, isCancelledRequest } from "../../api/client";
import { mapReview } from "../../api/dynamicMapper";
import toast from "react-hot-toast";
import {
  Check,
  Trash2,
  MessageSquare,
  Star,
  Search,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/Button";

const getReviewPayload = (responseData) => {
  const payload = responseData?.data || responseData || {};

  if (Array.isArray(payload)) {
    return {
      reviews: payload,
      meta: responseData?.meta || {},
    };
  }

  if (Array.isArray(payload.reviews)) {
    return {
      reviews: payload.reviews,
      meta: payload.meta || responseData?.meta || {},
    };
  }

  if (Array.isArray(payload.items)) {
    return {
      reviews: payload.items,
      meta: payload.meta || responseData?.meta || {},
    };
  }

  return {
    reviews: [],
    meta: responseData?.meta || {},
  };
};

const isCancelError = (err) => {
  return (
    isCancelledRequest?.(err) ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
};

const safeRating = (value) => {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  return Math.min(Math.max(rating, 0), 5);
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
};

const normalizeReview = (raw, index) => {
  const mapped = mapReview(raw || {});
  const id = String(raw?._id || raw?.id || mapped?.id || `review-${index}`);

  return {
    ...mapped,
    raw,
    id,
    user:
      mapped?.user ||
      raw?.user?.name ||
      raw?.customer?.name ||
      raw?.name ||
      "User",
    product:
      mapped?.product ||
      raw?.product?.title ||
      raw?.product?.name ||
      raw?.productName ||
      "",
    comment: mapped?.comment || raw?.comment || raw?.review || raw?.message || "",
    rating: safeRating(mapped?.rating ?? raw?.rating),
    status: mapped?.status || raw?.status || (raw?.isApproved ? "approved" : "pending"),
    createdAt: mapped?.createdAt || raw?.createdAt || raw?.updatedAt || null,
  };
};

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [busyId, setBusyId] = useState(null);

  const fetchReviews = useCallback(
    async (signal) => {
      try {
        setLoading(true);

        const res = await api.get("/reviews/admin", {
          params: { page, limit: 20, sortBy },
          signal,
        });

        const { reviews: rawReviews, meta } = getReviewPayload(res?.data);
        const mapped = rawReviews.map((item, index) => normalizeReview(item, index));

        setReviews(mapped);
        setHasNextPage(Boolean(meta?.hasNextPage || meta?.nextPage));
      } catch (err) {
        if (isCancelError(err)) return;

        console.error("REVIEWS_ERROR:", err?.response?.data || err?.message);
        toast.error(err?.response?.data?.message || "Failed to load reviews");
        setReviews([]);
        setHasNextPage(false);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [page, sortBy]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchReviews(controller.signal);

    return () => controller.abort();
  }, [fetchReviews]);

  const handleApprove = async (id) => {
    if (!id || busyId) return;

    const previousReviews = reviews;

    setBusyId(id);
    setReviews((prev) =>
      prev.map((review) =>
        review.id === id ? { ...review, status: "approved" } : review
      )
    );

    try {
      await api.put(`/reviews/admin/${id}/approve`);
      toast.success("Approved");
    } catch (err) {
      console.error("REVIEW_APPROVE_ERROR:", err?.response?.data || err?.message);
      setReviews(previousReviews);
      toast.error(err?.response?.data?.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!id || busyId) return;
    if (!window.confirm("Delete review?")) return;

    const previousReviews = reviews;

    setBusyId(id);
    setReviews((prev) => prev.filter((review) => review.id !== id));

    try {
      await api.delete(`/reviews/admin/${id}`);
      toast.success("Deleted");
    } catch (err) {
      console.error("REVIEW_DELETE_ERROR:", err?.response?.data || err?.message);
      setReviews(previousReviews);
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return reviews;

    return reviews.filter((review) => {
      return (
        String(review?.user || "").toLowerCase().includes(query) ||
        String(review?.product || "").toLowerCase().includes(query) ||
        String(review?.comment || "").toLowerCase().includes(query)
      );
    });
  }, [reviews, search]);

  return (
    <div className="admin-shell">
      <div className="admin-card p-4 md:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="admin-heading flex items-center gap-2">
          <MessageSquare size={20} /> Reviews
        </h1>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => {
              setPage(1);
              setSortBy(e.target.value);
            }}
            className="control-input px-3 py-2 text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>

          <Button onClick={() => fetchReviews()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="admin-card p-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reviews..."
          className="control-input w-full pl-10 pr-4 py-2"
        />
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl" />
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={40} className="mx-auto mb-2" />
              No reviews found
            </div>
          ) : (
            filtered.map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="admin-card p-4"
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold">{review.user || "User"}</h3>

                    <p className="text-sm text-gray-500">
                      {formatDate(review.createdAt)}
                    </p>

                    <p className="mt-2 text-gray-700">
                      {review.comment || "No comment"}
                    </p>

                    <div className="flex mt-2">
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={index}
                          size={14}
                          fill={review.rating > index ? "#facc15" : "none"}
                          className={
                            review.rating > index ? "text-yellow-400" : "text-gray-300"
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {review.status === "pending" && (
                      <button
                        type="button"
                        disabled={busyId === review.id}
                        onClick={() => handleApprove(review.id)}
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-black uppercase disabled:opacity-60"
                      >
                        <Check size={14} /> Approve
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busyId === review.id}
                      onClick={() => handleDelete(review.id)}
                      className="inline-flex items-center justify-center gap-2 bg-rose-500 text-white px-3 py-2 rounded-lg text-xs font-black uppercase disabled:opacity-60"
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

      {!loading && (
        <div className="flex justify-between items-center">
          <Button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            Prev
          </Button>

          <span className="text-sm text-gray-500">Page {page}</span>

          <Button
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasNextPage}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
