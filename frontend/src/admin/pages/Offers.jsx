import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { mapOffer } from "../../api/dynamicMapper";
import { uploadImage } from "../../api/upload";
import { Plus, Edit2, Trash2, Sparkles, RefreshCw, X, Tag, Calendar, Users, Info, ArrowRight, ShieldCheck, Activity } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";

const defaultForm = {
  title: "",
  couponCode: "",
  discountType: "percentage",
  discountValue: "",
  applyTo: "all",
  applyToCategory: "",
  applyToProductId: "",
  startDate: "",
  endDate: "",
  usageLimit: "",
  perUserLimit: "",
  isActive: true,
  image: "",
  link: "",
  description: "",
  minOrderAmount: "",
  maxDiscount: "",
};

export default function Offers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [, setUploading] = useState(false);
  const [, setErrors] = useState({});
  const [formData, setFormData] = useState(defaultForm);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/offers");
      const data = res.data || res || [];
      setOffers(
        Array.isArray(data)
          ? data.map(mapOffer).map((o, i) => ({ ...o, raw: data[i] }))
          : []
      );
    } catch {
      toast.error("Marketing order sync failed");
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchOffers();
  }, []);

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const openCreate = () => {
    setEditingId(null);
    setErrors({});
    setFormData(defaultForm);
    setFormOpen(true);
  };

  const openEdit = (offer) => {
    const raw = offer.raw || {};
    setEditingId(offer.id);
    setErrors({});
    setFormData({
      title: raw.title || "",
      couponCode: raw.couponCode || "",
      discountType: raw.discountType || "percentage",
      discountValue: raw.discountValue ?? "",
      applyTo: raw.applyTo || "all",
      applyToCategory: raw.applyToCategory || "",
      applyToProductId: raw.applyToProductId || "",
      startDate: raw.startDate?.split("T")[0] || "",
      endDate: raw.endDate?.split("T")[0] || "",
      usageLimit: raw.usageLimit ?? "",
      perUserLimit: raw.perUserLimit ?? "",
      isActive: raw.isActive ?? true,
      image: raw.image || "",
      link: raw.link || "",
      description: raw.description || "",
      minOrderAmount: raw.minOrderAmount ?? "",
      maxDiscount: raw.maxDiscount ?? "",
    });
    setFormOpen(true);
  };

  const generateCoupon = () => {
    const prefix = (formData.title || "DEAL")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    updateField("couponCode", `${prefix}${suffix}`);
  };

  const validateForm = () => {
    const next = {};
    if (!formData.title.trim()) next.title = "Identifier required";
    if (!formData.couponCode.trim()) next.couponCode = "Code order required";
    const discountValue = Number(formData.discountValue || 0);
    if (!Number.isFinite(discountValue) || discountValue <= 0) next.discountValue = "Mathematical value required";
    if (!formData.startDate || !formData.endDate) next.endDate = "Temporal range required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };



  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadImage(file);
      updateField("image", imageUrl);
      toast.success("Visual Save Complete");
    } catch {
      toast.error(err?.response?.data?.message || "Visual Save Failure");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    const payload = {
      title: formData.title.trim(),
      couponCode: (formData.couponCode || "").trim().toUpperCase(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      applyTo: formData.applyTo,
      applyToCategory: formData.applyToCategory.trim(),
      applyToProductId: formData.applyToProductId || null,
      startDate: formData.startDate,
      endDate: formData.endDate,
      usageLimit: Number(formData.usageLimit || 0),
      perUserLimit: Number(formData.perUserLimit || 0),
      isActive: formData.isActive,
      image: formData.image,
      link: formData.link.trim(),
      description: formData.description.trim() || formData.title.trim(),
      minOrderAmount: Number(formData.minOrderAmount || 0),
      maxDiscount: formData.maxDiscount !== "" ? Number(formData.maxDiscount) : null,
    };

    try {
      if (editingId) {
        await api.put(`/admin/offers/${editingId}`, payload);
        toast.success("Order Updated");
      } else {
        await api.post("/admin/offers", payload);
        toast.success("Order Appended");
      }
      setFormOpen(false);
      fetchOffers();
    } catch {
      toast.error(err?.response?.data?.message || "Save Failure");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Terminate this marketing order?")) return;
    try {
      await api.delete(`/admin/offers/${id}`);
      toast.success("Order Deleted");
      fetchOffers();
    } catch {
      toast.error("Delete Failure");
    }
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-gray-100 pb-6">
        <div className="space-y-2">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">
             Marketing List
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">
             Offers
          </h1>
        </div>

        <Button
          variant="primary"
          onClick={openCreate}
        >
          <Plus size={18} strokeWidth={3} />
          Add Offer
        </Button>
      </div>

      {/* Control Strip */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-[#f1f5f9] p-3 rounded-xl border border-gray-100 shadow-inner">
         <div className="flex items-center gap-3 px-2">
            <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
               <Tag size={14} className="text-[#1e3a8a]" /> {offers.length} Active Campaigns
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black text-[#0f172a] uppercase tracking-widest">
               <Sparkles size={14} className="text-[#1e3a8a]" /> High-Conversion
            </div>
         </div>
         
         <div className="flex items-center gap-2 px-2">
            <Activity size={14} className="text-[#1e3a8a]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-[#0f172a]">Update Monitor Live</span>
         </div>
      </div>

      {/* Table-style Listing */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 space-y-4 ">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-[#f1f5f9] rounded-lg" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="py-24 text-center bg-[#f1f5f9] rounded-xl border border-dashed border-gray-200">
             <p className="text-xs font-black uppercase tracking-widest text-gray-300">No records found. No active marketing logics.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {offers?.map((off) => {
              const s = off.status || "OFF";
              const isExpired = s === "EXPIRED";
              const isLimitReached = s === "LIMIT ENDED";
              const isComing = s === "COMING";
              const isActive = s === "ACTIVE";

              return (
                <div
                  key={off.id}
                  className={`flex items-center justify-between p-4 transition-all group border-b border-gray-50 last:border-0 ${
                    isExpired ? "opacity-60 bg-gray-50/50" : 
                    isLimitReached ? "bg-red-50/30 border-l-4 border-l-red-500" : 
                    "hover:bg-[#f1f5f9]"
                  }`}
                >
                  {/* Left */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={off.image || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400&auto=format&fit=crop"}
                        className={`w-20 h-14 object-cover rounded-xl ring-1 ring-gray-100 transition-all ${!isExpired ? 'group-hover:ring-[#1e3a8a]' : 'grayscale'}`}
                      />
                      
                      {/* Dynamic Badge Engine */}
                      <div className="absolute -top-2 -right-2 transform scale-90">
                        {isComing && (
                          <div className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                            <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" /> COMING
                          </div>
                        )}
                        {isActive && (
                          <div className="bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1">
                            <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> LIVE
                          </div>
                        )}
                        {isExpired && (
                          <div className="bg-gray-200 text-gray-600 border border-gray-300 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                            EXPIRED
                          </div>
                        )}
                        {isLimitReached && (
                          <div className="bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                            LIMIT ENDED
                          </div>
                        )}
                        {s === "OFF" && (
                          <div className="bg-gray-100 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm">
                            DISABLED
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className={`text-sm font-black uppercase tracking-tight transition-colors ${isExpired ? 'text-gray-400' : 'text-[#0f172a] group-hover:text-[#1e3a8a]'}`}>
                        {off?.title || "Untitled Campaign"}
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                           <ShieldCheck size={10} className="text-[#1e3a8a]" /> {(off?.couponCode || "").toUpperCase()}
                        </div>
                        <div className="h-3 w-[1px] bg-gray-200" />
                        <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${isLimitReached ? 'text-red-500' : 'text-gray-400'}`}>
                           <Users size={10} /> {off.usedCount} / {off.usageLimit || "∞"} USED
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="icon" onClick={() => openEdit(off)}>
                      <Edit2 size={16} />
                    </Button>
                    <Button variant="icon" onClick={() => handleDelete(off.id)}>
                      <Trash2 size={16} className="text-red-400" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULL SCREEN MODAL FORM */}
      {formOpen && (
        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto animate-in fade-in duration-500">
          <div className="max-w-[1200px] mx-auto p-3 md:p-12">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-12 border-b border-gray-100 pb-6">
               <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black text-[#0f172a] tracking-tighter uppercase">
                    {editingId ? "Edit Campaign" : "New Offer"}
                  </h2>
               </div>
               
               <Button 
                variant="icon"
                onClick={() => setFormOpen(false)}
               >
                 <X size={20} />
               </Button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              
              {/* LEFT SIDE (FORM) */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* SECTION 1: BASIC INFO */}
                <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Basic Info</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Title *</label>
                      <input value={formData.title} onChange={(e) => updateField("title", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Coupon Code *</label>
                      <div className="flex gap-2">
                        <input value={formData.couponCode} onChange={(e) => updateField("couponCode", e.target.value.toUpperCase())} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button type="button" onClick={generateCoupon} className="h-11 w-11 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-700 transition">
                          <RefreshCw size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SECTION 2: OFFER DETAILS */}
                <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Offer Details</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Type</label>
                      <select value={formData.discountType} onChange={(e) => updateField("discountType", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="percentage">Percentage</option>
                        <option value="flat">Flat Value</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Value *</label>
                      <input type="number" min="0" value={formData.discountValue} onChange={(e) => updateField("discountValue", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Scope</label>
                      <select value={formData.applyTo} onChange={(e) => updateField("applyTo", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="all">Universal</option>
                        <option value="category">Category</option>
                        <option value="product">Product</option>
                      </select>
                    </div>
                  </div>
                  {formData.applyTo === "category" && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Category</label>
                      <input value={formData.applyToCategory} onChange={(e) => updateField("applyToCategory", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Men, Shoes..." />
                    </div>
                  )}
                </div>

                {/* SECTION 3: DATE RANGE */}
                <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Date Range</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Start Date</label>
                      <input type="date" value={formData.startDate} onChange={(e) => updateField("startDate", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">End Date</label>
                      <input type="date" value={formData.endDate} onChange={(e) => updateField("endDate", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>
                
                {/* SECTION 4: FINANCIAL SAFEGUARDS */}
                <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Financial Safeguards</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Min Order Amount (₹)</label>
                      <input type="number" min="0" value={formData.minOrderAmount} onChange={(e) => updateField("minOrderAmount", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0 = no minimum" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Max Discount (₹)</label>
                      <input type="number" min="0" value={formData.maxDiscount} onChange={(e) => updateField("maxDiscount", e.target.value)} disabled={formData.discountType === 'flat'} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" placeholder="unlimited" />
                      {formData.discountType === 'flat' && <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-tighter">Only for percentage types</p>}
                    </div>
                  </div>
                </div>

                {/* BUTTON SECTION */}
                <div className="flex gap-4 pt-4">
                   <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition">
                     {saving ? "Saving..." : "Save Offer"}
                   </button>
                   <button type="button" onClick={() => setFormOpen(false)} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-100 transition">
                      Cancel
                   </button>
                </div>
              </div>

              {/* RIGHT SIDE (MEDIA + USAGE) */}
              <div className="lg:col-span-2 space-y-6">
                 
                 {/* MEDIA CARD */}
                 <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Media</h3>
                    {formData.image ? (
                       <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200">
                          <img src={formData.image} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => updateField("image", "")} className="absolute top-2 right-2 h-8 w-8 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition shadow-sm">
                             <X size={16} strokeWidth={2.5} />
                          </button>
                       </div>
                    ) : (
                       <div
                         onClick={() => document.getElementById("offer-image-upload").click()}
                         className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 cursor-pointer transition-colors"
                       >
                         <Sparkles className="text-gray-400 mx-auto mb-3" size={32} />
                         <p className="text-sm font-medium text-gray-600">Click to upload promotion image</p>
                         <input id="offer-image-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                       </div>
                    )}
                 </div>

                 {/* USAGE SECTION */}
                 <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Usage Limits</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-1 block">Limit</label>
                        <input type="number" min="0" value={formData.usageLimit} onChange={(e) => updateField("usageLimit", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0 = unlim" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-1 block">Per User</label>
                        <input type="number" min="0" value={formData.perUserLimit} onChange={(e) => updateField("perUserLimit", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0 = unlim" />
                      </div>
                    </div>
                 </div>

                 {/* ACTIVE UPDATE (TEXTAREA CARD) */}
                 <div className="bg-white rounded-xl p-5 shadow-sm space-y-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" checked={formData.isActive} onChange={(e) => updateField("isActive", e.target.checked)} />
                        <span className="text-sm font-medium text-gray-800">Active Campaign</span>
                    </label>
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
                      <textarea rows={3} value={formData.description} onChange={(e) => updateField("description", e.target.value)} className="w-full bg-gray-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Campaign details..." />
                    </div>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}