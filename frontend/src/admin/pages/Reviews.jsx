import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { mapReview } from "../../api/dynamicMapper";
import { 
  Check, 
  Trash2, 
  MessageSquare, 
  Star, 
  Filter, 
  Sparkles, 
  User as UserIcon, 
  Zap, 
  Search,
  MoreVertical,
  ThumbsUp,
  Clock,
  ShieldCheck,
  AlertCircle,
  Activity
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/ui/Button";

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await api.get("/reviews/admin/list");
      const data = res.data || res.reviews || res || [];
      const mapped = Array.isArray(data) ? data.map(mapReview) : [];
      setReviews(mapped);
    } catch {
      toast.error("Cloud synchronization failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleApprove = async (id) => {
    try {
      await api.put(`/reviews/admin/${id}/approve`);
      toast.success("Sentiment Validated & Published");
      fetchReviews();
    } catch {
      toast.error("Activation Failure");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently archive this review signal?")) return;
    try {
      await api.delete(`/reviews/admin/${id}`);
      toast.success("Signal Purged Successfully");
      fetchReviews();
    } catch {
      toast.error("Purge Protocol Failure");
    }
  };

  const filtered = reviews.filter(r => 
    r.user?.toLowerCase().includes(search.toLowerCase()) || 
    r.product?.toLowerCase().includes(search.toLowerCase()) ||
    r.comment?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* 🏙️ MODERN HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
             <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
                <MessageSquare size={16} strokeWidth={2.5} />
             </div>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Quality Control</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4 uppercase">
             Reviews
             <span className="bg-slate-900 text-white text-[10px] px-3 py-1 rounded-full font-bold tracking-widest leading-none">
                {reviews.length} Manifests
             </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
           <div className="flex -space-x-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-8 w-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                   <div className="h-full w-full bg-gradient-to-br from-indigo-50 to-indigo-100" />
                </div>
              ))}
              <div className="h-8 w-8 rounded-full border-2 border-white bg-indigo-600 flex items-center justify-center text-[8px] font-bold text-white z-10">
                 +1k
              </div>
           </div>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-2">Sentiment High</p>
        </div>
      </div>

      {/* 🔍 FILTER INTERFACE */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-8 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search users, products or signal keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-14 pl-12 pr-6 rounded-2xl bg-white border border-slate-100 text-sm focus:ring-4 focus:ring-indigo-50 border-slate-200 outline-none transition-all placeholder:text-slate-300 shadow-sm"
          />
        </div>
        
        <div className="md:col-span-4 flex items-center gap-2">
           <Button variant="secondary" className="flex-1 h-14 rounded-2xl border border-slate-100 bg-white shadow-sm hover:bg-slate-50 text-slate-600">
              <Filter size={16} /> Filters
           </Button>
           <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={20} />
           </div>
        </div>
      </div>

      {/* 📮 REVIEW GRID */}
      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {loading ? (
            [1,2,3].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-slate-50 animate-pulse border border-slate-100 shadow-sm" />
            ))
          ) : filtered.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-32 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200"
            >
               <div className="h-16 w-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <AlertCircle size={32} strokeWidth={1.5} />
               </div>
               <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">
                 No sentiment signals localized in the current sector.
               </p>
            </motion.div>
          ) : (
            filtered.map((rev) => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                key={rev.id} 
                className="group bg-white rounded-3xl border border-slate-100 p-6 md:p-8 hover:shadow-xl hover:shadow-slate-200/50 hover:border-indigo-100 transition-all duration-500 relative overflow-hidden"
              >
                {/* STATUS BADGE */}
                {rev.status === "pending" && (
                  <div className="absolute top-0 right-12 px-4 py-1.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-b-xl shadow-lg shadow-amber-200/50 z-20">
                     Awaiting Validation
                  </div>
                )}

                <div className="flex flex-col lg:flex-row gap-8">
                  {/* USER CONTENT */}
                  <div className="flex-1 space-y-8">
                    {/* Header: Avatar + Meta */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                           <UserIcon size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">{rev.user}</h4>
                          <LinkPreview email={rev.email} />
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                           <Clock size={12} /> {new Date(rev.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Review Body */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                         <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest shadow-xl">
                            <Zap size={12} className="text-indigo-400" /> {rev.product?.length > 25 ? rev.product.slice(0, 25) + "..." : rev.product}
                         </div>
                         <div className="flex gap-1.5 bg-indigo-50/50 px-3 py-2 rounded-xl border border-indigo-100/50">
                           {[...Array(5)].map((_, i) => (
                             <Star 
                                key={i} 
                                size={14} 
                                fill={rev.rating > i ? "#4f46e5" : "none"} 
                                className={rev.rating > i ? "text-indigo-600" : "text-indigo-200"} 
                                strokeWidth={2.5} 
                             />
                           ))}
                         </div>
                      </div>
                      
                      <blockquote className="text-lg md:text-xl font-medium text-slate-600 leading-snug tracking-tight">
                        &quot;{rev.comment}&quot;
                      </blockquote>
                    </div>
                  </div>

                  {/* ACTION CONTROLS */}
                  <div className="flex lg:flex-col items-center justify-center gap-3 shrink-0 pt-6 lg:pt-0 lg:pl-10 border-t lg:border-t-0 lg:border-l border-slate-50">
                    {rev.status === "pending" && (
                      <button
                        onClick={() => handleApprove(rev.id)}
                        className="flex-1 lg:w-32 h-14 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Check size={16} strokeWidth={3} /> Save
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(rev.id)}
                      className="flex-1 lg:w-32 h-14 bg-white border-2 border-slate-100 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all flex items-center justify-center gap-2 group/delete"
                    >
                      <Trash2 size={16} className="group-hover/delete:animate-bounce" /> Abort
                    </button>
                    
                    <button className="h-14 w-14 flex items-center justify-center text-slate-300 hover:text-slate-900 transition-colors">
                       <MoreVertical size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
      
      {/* 🔮 MONITORING FOOTER */}
      <footer className="pt-12 flex flex-wrap justify-center gap-8 mb-12">
          <FooterMetric icon={<ShieldCheck size={16} />} text="Trust Verified" color="text-indigo-500" />
          <FooterMetric icon={<Activity size={16} />} text="Metric Integrity" color="text-slate-400" />
          <FooterMetric icon={<ThumbsUp size={16} />} text="Approval Master" color="text-emerald-500" />
      </footer>
    </div>
  );
}

function LinkPreview({ email }) {
  return (
    <div className="flex items-center gap-2 mt-1 px-3 py-1 bg-slate-50 rounded-lg group grow-hover:bg-indigo-50 transition-colors border border-transparent group-hover:border-indigo-100 w-fit">
      <p className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors uppercase tracking-[0.1em]">{email}</p>
    </div>
  );
}

function FooterMetric({ icon, text, color }) {
  return (
    <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
       <div className={`${color}`}>{icon}</div>
       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{text}</span>
    </div>
  );
}
