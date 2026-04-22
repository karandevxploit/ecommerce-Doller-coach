import { useState, useEffect } from "react";
import { Star, MessageSquare, Pen } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "../api/client";
import { useAuthStore } from "../store";
import toast from "react-hot-toast";
import SafeText from "./common/SafeText";

/* ---------------- TIME AGO ---------------- */
const timeAgo = (date) => {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hrs ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} days ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
};

export default function ProductTabs({ product }) {
  const prefersReducedMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState("description");
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const { isAuthenticated } = useAuthStore();

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const productId = product?.id || product?._id;

  /* ---------------- FETCH REVIEWS ---------------- */
  useEffect(() => {
    if (activeTab !== "reviews" || !productId) return;

    const fetch = async () => {
      setLoadingReviews(true);
      try {
        const res = await api.get(`/reviews/${productId}`);
        const safe = Array.isArray(res) ? res : res?.data || [];
        setReviews(safe);
      } catch {
        toast.error("Failed to load reviews");
      } finally {
        setLoadingReviews(false);
      }
    };

    fetch();
  }, [activeTab, productId]);

  /* ---------------- SUBMIT ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) return toast.error("Select a rating");
    if (!comment.trim()) return toast.error("Write your review");

    setSubmitting(true);
    try {
      const res = await api.post("/reviews", {
        productId,
        rating,
        comment
      });

      const newReview = res?.data || res;
      setReviews((prev) => [newReview, ...prev]);

      toast.success("Review submitted");
      setShowForm(false);
      setRating(0);
      setComment("");
    } catch {
      toast.error("Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const avg = Number(product?.ratings?.average || 0);
  const count = Number(product?.ratings?.count || 0);

  /* ---------------- UI ---------------- */
  return (
    <div className="w-full mt-10">

      {/* TABS */}
      <div className="flex gap-6 border-b border-slate-200 pb-2 overflow-x-auto">
        {["description", "specifications", "reviews"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            className={`pb-2 text-sm font-semibold capitalize border-b-2 transition ${activeTab === tab
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
          >
            {tab}
            {tab === "reviews" && count > 0 && (
              <span className="ml-2 text-xs bg-slate-100 px-2 py-0.5 rounded">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="py-8">

        <AnimatePresence mode="wait">

          {/* DESCRIPTION */}
          {activeTab === "description" && (
            <motion.div
              key="desc"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-600 space-y-4"
            >
              <SafeText>
                {product?.fullDescription ||
                  product?.description ||
                  "No description available."}
              </SafeText>
            </motion.div>
          )}

          {/* SPECIFICATIONS */}
          {activeTab === "specifications" && (
            <motion.div
              key="specs"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid md:grid-cols-2 gap-4 text-sm"
            >
              {(product?.specifications || []).length ? (
                product.specifications.map((s, i) => (
                  <div key={i} className="border-b pb-2">
                    <p className="text-slate-400 text-xs">{s.label}</p>
                    <p className="font-medium text-slate-900">{s.val}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No specifications available</p>
              )}
            </motion.div>
          )}

          {/* REVIEWS */}
          {activeTab === "reviews" && (
            <motion.div
              key="reviews"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >

              {/* SUMMARY */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-2xl font-bold">{avg.toFixed(1)}</p>
                  <div className="flex text-yellow-400">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star key={i} size={14} fill={i <= avg ? "currentColor" : "none"} />
                    ))}
                  </div>
                </div>

                {isAuthenticated && (
                  <button
                    onClick={() => setShowForm((p) => !p)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
                  >
                    <Pen size={14} /> Write review
                  </button>
                )}
              </div>

              {/* FORM */}
              <AnimatePresence>
                {showForm && (
                  <motion.form
                    onSubmit={handleSubmit}
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    className="mb-6 space-y-4 overflow-hidden"
                  >
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star
                          key={i}
                          size={24}
                          onClick={() => setRating(i)}
                          className={`cursor-pointer ${i <= rating ? "text-yellow-400" : "text-slate-300"
                            }`}
                        />
                      ))}
                    </div>

                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your experience"
                      className="w-full border rounded-lg p-3 text-sm"
                    />

                    <button
                      disabled={submitting}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm"
                    >
                      {submitting ? "Submitting..." : "Submit review"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* LIST */}
              {loadingReviews ? (
                <p className="text-sm text-slate-400">Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <MessageSquare size={28} className="mx-auto mb-2" />
                  No reviews yet
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((r) => (
                    <div key={r._id} className="border rounded-lg p-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {r?.user?.name || "User"}
                        </span>
                        <span className="text-slate-400">
                          {timeAgo(r?.createdAt)}
                        </span>
                      </div>

                      <div className="flex text-yellow-400 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill={i < r.rating ? "currentColor" : "none"}
                          />
                        ))}
                      </div>

                      <SafeText className="text-sm mt-2 text-slate-600">
                        {r.comment}
                      </SafeText>
                    </div>
                  ))}
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>

      </div>
    </div>
  );
}