import { useState, useEffect } from "react";
import { api } from "../../api/client";
import { mapProduct } from "../../api/dynamicMapper";
import { uploadMultipleImages, uploadProductVideo } from "../../api/upload";
import { Plus, Edit2, Trash2, Search as SearchIcon, Sparkles, UploadCloud, X, RefreshCw, Package, ArrowRight, Image as ImageIcon, Layers, Tag as TagIcon, Layout, Info, ShieldCheck, Zap, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import { categoryData } from "../constants/categoryData";

const defaultForm = {
  title: "",
  brand: "",
  category: "MEN",
  subcategory: "",
  productType: "",
  type: "TOPWEAR",
  originalPrice: "",
  discountPrice: "",
  stock: "",
  sku: "",
  shortDescription: "",
  fullDescription: "",
  featured: false,
  trending: false,
  images: [],
  video: "",
  sizes: [],
  topSizes: [],
  bottomSizes: [],
};

const formatPrice = (p) => Number(p || 0).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function Products() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState(defaultForm);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  // Auto-revoke Object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      imagePreviews.forEach(URL.revokeObjectURL);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreviews, videoPreview]);

  const fetchProducts = async (page = 1) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/products?page=${page}&limit=20&q=${search}`);
      const data = res?.data || res || {};
      const list = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      
      setProducts(list.map(mapProduct));
      setFiltered(list.map(mapProduct));
      setMeta({
        page: data.meta?.page || 1,
        totalPages: data.meta?.totalPages || 1
      });
      setCurrentPage(page);
    } catch (err) {
      toast.error("Error loading: Catalog Access");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleDelete = async (id) => {
    if (!window.confirm("Authorize permanent product erasure?")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success("Product Deleted");
      fetchProducts(currentPage);
    } catch (err) {
      toast.error("Erasure Order Failure");
    }
  };



  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const openCreate = () => {
    setEditingId(null);
    setSelectedFiles([]);
    setVideoFile(null);
    setErrors({});
    setFormData(defaultForm);
    setImagePreviews([]);
    setVideoPreview(null);
    setFormOpen(true);
  };

  const openEdit = (prod) => {
    setEditingId(prod.id);
    setSelectedFiles([]);
    setVideoFile(null);
    setErrors({});
    setFormData({
      title: prod.title || "",
      brand: prod.brand || "",
      category: String(prod.category || "MEN").toUpperCase(),
      subcategory: prod.subcategory || "",
      productType: prod.productType || "",
      type: String(prod.type || "TOPWEAR").toUpperCase(),
      originalPrice: prod.originalPrice ?? prod.price ?? "",
      discountPrice: prod.discountPrice ?? "",
      stock: prod.stock ?? 0,
      sku: prod.sku || "",
      shortDescription: prod.shortDescription || "",
      fullDescription: prod.fullDescription || prod.description || "",
      featured: Boolean(prod.featured),
      trending: Boolean(prod.trending),
      images: Array.isArray(prod.images) ? prod.images : (prod.image ? [prod.image] : []),
      video: prod.video || "",
      sizes: Array.isArray(prod.sizes) ? prod.sizes : [],
      topSizes: Array.isArray(prod.topSizes) ? prod.topSizes : [],
      bottomSizes: Array.isArray(prod.bottomSizes) ? prod.bottomSizes : [],
    });
    setFormOpen(true);
  };

  const validateForm = () => {
    const next = {};
    if (!String(formData.title || "").trim()) next.title = "Name is required for protocol";
    if (!formData.category) next.category = "Category allocation required";
    if (!formData.subcategory) next.subcategory = "Subcategory required";
    if (!formData.productType) next.productType = "Product Type required";
    if (!formData.originalPrice || Number(formData.originalPrice) < 0) next.originalPrice = "Financial value required";
    if (!String(formData.fullDescription || formData.description || "").trim()) next.fullDescription = "Data manifest/description required";
    
    if (formData.type === "FULL_OUTFIT") {
      if (!formData.topSizes || formData.topSizes.length === 0) next.topSizes = "Top dimensions missing";
      if (!formData.bottomSizes || formData.bottomSizes.length === 0) next.bottomSizes = "Bottom dimensions missing";
    } else {
      if (!formData.sizes || formData.sizes.length === 0) next.sizes = "Standard sizing required";
    }

    if (formData.images.length === 0) next.images = "Visual nodes/images required";
    
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Validation failure. Check protocol fields.");
      return false;
    }
    return true;
  };

  const generateSku = () => {
    const base = `${formData.category || "GEN"}-${formData.title || "ITEM"}`
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toUpperCase()
      .slice(0, 16);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    updateField("sku", `${base}-${suffix}`);
  };

  const onPickFiles = (files) => {
    const fileList = Array.from(files || []);
    setSelectedFiles(fileList);
    
    // Generate previews
    const previews = fileList.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  const onPickVideo = (file) => {
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeImage = (index) => {
    setFormData((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const handleUploadImages = async () => {
    if (!selectedFiles.length) return toast.error("Visual nodes required");
    setUploading(true);
    try {
      const urls = await uploadMultipleImages(selectedFiles);
      updateField("images", [...formData.images, ...urls]);
      setSelectedFiles([]);
      toast.success("Images uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Save Order Failure");
    } finally {
      setUploading(false);
    }
  };

  const handleUploadVideo = async () => {
    if (!videoFile) return toast.error("Choose a video first");
    setVideoUploading(true);
    try {
      const url = await uploadProductVideo(videoFile);
      updateField("video", url);
      setVideoFile(null);
      setVideoPreview(null);
      toast.success("Video uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Video upload failed");
    } finally {
      setVideoUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        brand: formData.brand.trim(),
        category: String(formData.category || "MEN").trim().toUpperCase(),
        subcategory: formData.subcategory.trim(),
        productType: formData.productType.trim(),
        type: String(formData.type || "TOPWEAR").trim().toUpperCase(),
        originalPrice: Number(formData.originalPrice || 0),
        discountPrice: Number(formData.discountPrice || 0),
        price: Number(formData.discountPrice || 0) > 0 ? Number(formData.discountPrice) : Number(formData.originalPrice),
        stock: Number(formData.stock || 0),
        sku: formData.sku.trim(),
        shortDescription: formData.shortDescription.trim(),
        fullDescription: formData.fullDescription.trim(),
        description: formData.fullDescription.trim() || formData.shortDescription.trim(),
        featured: formData.featured,
        trending: formData.trending,
        images: formData.images,
        video: formData.video || "",
        sizes: formData.sizes,
        topSizes: formData.topSizes,
        bottomSizes: formData.bottomSizes,
      };

      if (editingId) {
        await api.put(`/admin/products/${editingId}`, payload);
        toast.success("Product Updated");
      } else {
        await api.post("/admin/products", payload);
        toast.success("Product Created");
      }
      setFormOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Transmission Failure");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* HEADER PROTOCOL */}
      <div className="flex justify-between items-end border-b border-[#F2F2F2] pb-6">
        <div className="space-y-2">
          <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest ml-1">
            Inventory
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">
             Item catalog
          </h1>
        </div>

        <Button
          variant="primary"
          onClick={openCreate}
        >
          <Plus size={18} strokeWidth={3} /> Add item
        </Button>
      </div>

      {/* COMMAND INTERFACE */}
      <div className="flex flex-col lg:flex-row gap-3 items-center justify-between bg-[#f1f5f9] p-3 rounded-xl border border-[#F2F2F2]">
        <div className="relative w-full lg:w-[400px] group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
          <input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg bg-white border border-transparent text-[#0f172a] font-black uppercase tracking-widest text-[10px] focus:border-[#1e3a8a] outline-none transition-all shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-5 px-4">
           <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
              <Package size={14} className="text-[#1e3a8a]" /> {products.length} Items
           </div>
           <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
              <Sparkles size={14} className="text-[#1e3a8a]" /> Registry: OK
           </div>
        </div>
      </div>

      {/* MANIFEST GRID */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map((i) => (
            <div key={i} className="aspect-[3/4] bg-[#f1f5f9] border border-[#F2F2F2] rounded-xl " />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center bg-[#f1f5f9] rounded-xl border border-dashed border-gray-200">
           <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">No results found. No products localized.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((prod) => (
            <div
              key={prod.id}
              className="bg-white border border-[#F2F2F2] rounded-xl overflow-hidden shadow-sm hover:border-[#1e3a8a]/30 hover:shadow-md transition-all flex flex-col group"
            >
              <div className="aspect-[4/5] overflow-hidden relative">
                <img src={prod.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={prod.title} />
                
                {/* STOCK BADGE */}
                <div className="absolute top-3 left-3 z-10 bg-[#0f172a]/85 backdrop-blur-md text-white px-2 py-1 rounded-md font-black text-[7px] uppercase tracking-widest">
                  STK: {prod.stock}
                </div>

                {/* ADMIN ACTIONS OVERLAY - ALWAYS VISIBLE */}
                <div className="absolute inset-0 z-20 flex flex-col justify-end p-3 bg-gradient-to-t from-[#0f172a]/60 to-transparent">
                   <div className="flex gap-2">
                      <button 
                        onClick={() => openEdit(prod)}
                        className="flex-1 h-9 bg-white text-[#0f172a] rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shadow-lg active:scale-95"
                      >
                        <Edit2 size={12} strokeWidth={3} /> Edit
                      </button>
                      <button 
                         onClick={() => handleDelete(prod.id)}
                         className="flex-1 h-9 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-lg active:scale-95"
                      >
                        <Trash2 size={12} strokeWidth={3} /> Delete
                      </button>
                   </div>
                </div>
              </div>

              <div className="p-3 space-y-1 flex-1 flex flex-col">
                <h3 className="text-[11px] font-black text-[#0f172a] tracking-tight uppercase line-clamp-2 min-h-[2.5rem] leading-tight">
                  {prod.title}
                </h3>
                <div className="flex justify-between items-center pt-2 border-t border-gray-50 mt-auto">
                  <span className="text-sm font-black text-[#0f172a] tracking-tighter">
                    {formatPrice(prod.price)}
                  </span>
                  <span className="text-[7px] font-black text-gray-300 uppercase tracking-widest">{prod.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAGINATION INTERFACE */}
      {!loading && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-8 border-t border-[#F2F2F2] mt-12 bg-white rounded-xl shadow-sm">
          <button
            disabled={currentPage === 1}
            onClick={() => fetchProducts(currentPage - 1)}
            className="h-10 px-6 rounded-lg border border-gray-200 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 transition-all flex items-center gap-2"
          >
            Previous Sector
          </button>
          <div className="flex items-center gap-3 px-6 px-10 border-x border-gray-100">
             <span className="text-[10px] font-black text-[#0f172a] uppercase tracking-[0.2em] leading-none">
               Sector {currentPage} <span className="text-gray-300 mx-2">/</span> {meta.totalPages}
             </span>
          </div>
          <button
            disabled={currentPage === meta.totalPages}
            onClick={() => fetchProducts(currentPage + 1)}
            className="h-10 px-6 rounded-lg bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#1e3a8a] disabled:opacity-30 transition-all flex items-center gap-2 shadow-lg"
          >
            Next Sector
          </button>
        </div>
      )}

      {/* LOGIC CONSTRUCT MODAL */}
        {formOpen && (
          <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
            <div className="max-w-[1200px] mx-auto p-3 md:p-12">
              <div className="flex items-center justify-between mb-12 border-b border-[#F2F2F2] pb-6">
                 <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-black text-[#0f172a] tracking-tighter uppercase">
                      {editingId ? "Edit item" : "New item"}
                    </h2>
                 </div>
                 
                 <Button 
                  variant="icon"
                  onClick={() => setFormOpen(false)}
                 >
                   <X size={20} />
                 </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
                  
                  {/* SECTION 1: BASIC INFO */}
                  <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Basic Info</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-1 block">Product Name *</label>
                        <input value={formData.title} onChange={(e) => updateField("title", e.target.value)} className={`w-full bg-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${errors.title ? "ring-2 ring-red-500" : "focus:ring-indigo-500"}`} />
                        {errors.title && <p className="text-[9px] font-black text-red-500 uppercase mt-1 ml-1">{errors.title}</p>}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600 mb-1 block">Brand</label>
                        <input value={formData.brand} onChange={(e) => updateField("brand", e.target.value)} className="w-full bg-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: CATEGORY ARCHITECTURE (CASCADING) */}
                  <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Architecture</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* 1. Category */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Category *</label>
                        <div className="relative group">
                          <select 
                            value={formData.category} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => ({ ...prev, category: val, subcategory: "", productType: "" }));
                              setErrors(prev => ({ ...prev, category: "", subcategory: "", productType: "" }));
                            }} 
                            className="w-full bg-gray-100 rounded-lg px-4 py-3 text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          >
                            <option value="">Select Category</option>
                            {["MEN", "WOMEN"].map((c) => (<option key={c} value={c}>{c}</option>))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-black transition-colors" />
                        </div>
                        {errors.category && <p className="text-[8px] font-black text-red-500 uppercase mt-1 ml-1">{errors.category}</p>}
                      </div>

                      {/* 2. Subcategory (Dependent on Category) */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Subcategory *</label>
                        <div className="relative group">
                          <select 
                            value={formData.subcategory}
                            disabled={!formData.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              // Auto-map Base Type for common cases
                              let autoType = formData.type;
                              if (val.toLowerCase().includes("topwear")) autoType = "TOPWEAR";
                              if (val.toLowerCase().includes("bottomwear")) autoType = "BOTTOMWEAR";
                              if (val === "Dresses") autoType = "TOPWEAR";

                              setFormData(prev => ({ ...prev, subcategory: val, productType: "", type: autoType }));
                              setErrors(prev => ({ ...prev, subcategory: "", productType: "" }));
                            }}
                            className={`w-full rounded-lg px-4 py-3 text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${!formData.category ? "bg-gray-50 text-gray-300 border-dashed border-gray-200 cursor-not-allowed" : "bg-gray-100 text-black border-transparent shadow-sm"}`}
                          >
                            <option value="">Select Subcategory</option>
                            {formData.category && categoryData[formData.category] && Object.keys(categoryData[formData.category]).map(sc => (
                              <option key={sc} value={sc}>{sc}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-black transition-colors" />
                        </div>
                        {errors.subcategory && <p className="text-[8px] font-black text-red-500 uppercase mt-1 ml-1">{errors.subcategory}</p>}
                      </div>

                      {/* 3. Product Type (Dependent on Subcategory) */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Product Type *</label>
                        <div className="relative group">
                          <select 
                            value={formData.productType}
                            disabled={!formData.subcategory}
                            onChange={(e) => {
                              updateField("productType", e.target.value);
                            }}
                            className={`w-full rounded-lg px-4 py-3 text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${!formData.subcategory ? "bg-gray-50 text-gray-300 border-dashed border-gray-200 cursor-not-allowed" : "bg-gray-100 text-black border-transparent shadow-sm"}`}
                          >
                            <option value="">Select Type</option>
                            {formData.category && formData.subcategory && categoryData[formData.category]?.[formData.subcategory]?.map(pt => (
                              <option key={pt} value={pt}>{pt}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-black transition-colors" />
                        </div>
                        {errors.productType && <p className="text-[8px] font-black text-red-500 uppercase mt-1 ml-1">{errors.productType}</p>}
                      </div>

                      {/* 4. Base Sizing Logic (Determines available size charts) */}
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Sizing Logic (Base Type) *</label>
                        <div className="relative group">
                          <select 
                            value={formData.type} 
                            onChange={(e) => {
                              updateField("type", e.target.value);
                              updateField("sizes", []);
                              updateField("topSizes", []);
                              updateField("bottomSizes", []);
                            }} 
                            className="w-full bg-gray-100 rounded-lg px-4 py-3 text-xs font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                          >
                            {["TOPWEAR", "BOTTOMWEAR", "FULL_OUTFIT"].map((t) => (<option key={t} value={t}>{t}</option>))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-black transition-colors" />
                        </div>
                        {errors.type && <p className="text-[8px] font-black text-red-500 uppercase mt-1 ml-1">{errors.type}</p>}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: SIZES & DETAILS */}
                  <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                     <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Dimensions & Economics</h3>
                     <div className="space-y-4">
                        <div>
                          {formData.type === "FULL_OUTFIT" ? (
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Top Sizes</label>
                                <div className="flex flex-wrap gap-2">
                                  {["S", "M", "L", "XL", "XXL"].map(size => (
                                    <button 
                                      key={size} type="button" 
                                      onClick={() => {
                                        const next = formData.topSizes.includes(size) ? formData.topSizes.filter(s => s !== size) : [...formData.topSizes, size];
                                        updateField("topSizes", next);
                                      }}
                                      className={`h-11 px-6 rounded-xl font-black text-[11px] tracking-widest transition-all shadow-sm ${formData.topSizes.includes(size) ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200"}`}
                                    >
                                      {size}
                                    </button>
                                  ))}
                                </div>
                                {errors.topSizes && <p className="text-[9px] font-black text-red-500 uppercase mt-1 ml-1">{errors.topSizes}</p>}
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Bottom Sizes</label>
                                <div className="flex flex-wrap gap-2">
                                  {["28", "30", "32", "34", "36", "38"].map(size => (
                                    <button 
                                      key={size} type="button" 
                                      onClick={() => {
                                        const next = formData.bottomSizes.includes(size) ? formData.bottomSizes.filter(s => s !== size) : [...formData.bottomSizes, size];
                                        updateField("bottomSizes", next);
                                      }}
                                      className={`h-11 px-6 rounded-xl font-black text-[11px] tracking-widest transition-all shadow-sm ${formData.bottomSizes.includes(size) ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200"}`}
                                    >
                                      {size}
                                    </button>
                                  ))}
                                </div>
                                {errors.bottomSizes && <p className="text-[9px] font-black text-red-500 uppercase mt-1 ml-1">{errors.bottomSizes}</p>}
                              </div>
                            </div>
                          ) : (
                            <>
                              <label className="text-sm font-medium text-gray-600 mb-1 block">Available Sizes ({formData.type})</label>
                              <div className="flex flex-wrap gap-2">
                                {(formData.type === "BOTTOMWEAR" 
                                  ? ["28", "30", "32", "34", "36", "38"] 
                                  : ["S", "M", "L", "XL", "XXL"]
                                ).map(size => (
                                  <button 
                                    key={size} 
                                    type="button" 
                                    onClick={() => {
                                      const next = formData.sizes.includes(size) ? formData.sizes.filter(s => s !== size) : [...formData.sizes, size];
                                      updateField("sizes", next);
                                    }}
                                    className={`h-11 px-6 rounded-xl font-black text-[11px] tracking-widest transition-all shadow-sm ${formData.sizes.includes(size) ? "bg-[#0f172a] text-white border-[#0f172a]" : "bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200"}`}
                                  >
                                    {size}
                                  </button>
                                ))}
                              </div>
                              {errors.sizes && <p className="text-[9px] font-black text-red-500 uppercase mt-1 ml-1">{errors.sizes}</p>}
                            </>
                          )}
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-1 block">Price *</label>
                            <input type="number" min="0" value={formData.originalPrice} onChange={(e) => updateField("originalPrice", e.target.value)} className={`w-full bg-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${errors.originalPrice ? "ring-2 ring-red-500" : "focus:ring-indigo-500"}`} />
                            {errors.originalPrice && <p className="text-[9px] font-black text-red-500 uppercase mt-1 ml-1">{errors.originalPrice}</p>}
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600 mb-1 block">Stock</label>
                            <input type="number" min="0" value={formData.stock} onChange={(e) => updateField("stock", e.target.value)} className="w-full bg-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-600 mb-1 block">SKU</label>
                          <div className="flex gap-2">
                             <input value={formData.sku} onChange={(e) => updateField("sku", e.target.value.toUpperCase())} className="w-full bg-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                             <button type="button" onClick={generateSku} className="h-11 w-11 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-700 transition">
                                <RefreshCw size={16} />
                             </button>
                          </div>
                        </div>
                        <div>
                           <label className="text-sm font-medium text-gray-600 mb-1 block">Description</label>
                           <textarea rows={4} value={formData.fullDescription} onChange={(e) => updateField("fullDescription", e.target.value)} className={`w-full bg-gray-100 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 ${errors.fullDescription ? "ring-2 ring-red-500" : "focus:ring-indigo-500"}`} placeholder="Product details..." />
                           {errors.fullDescription && <p className="text-[9px] font-black text-red-500 uppercase mt-1 ml-1">{errors.fullDescription}</p>}
                        </div>
                        <div className="flex gap-4 pt-2">
                           <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" checked={formData.featured} onChange={(e) => updateField("featured", e.target.checked)} />
                              <span className="text-sm font-medium text-gray-700">Featured Product</span>
                           </label>
                           <label className="flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500" checked={formData.trending} onChange={(e) => updateField("trending", e.target.checked)} />
                              <span className="text-sm font-medium text-gray-700">Trending</span>
                           </label>
                        </div>
                     </div>
                  </div>

                  {/* SECTION 4: IMAGES */}
                  <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Product Images</h3>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); onPickFiles(e.dataTransfer.files); }}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-500"}`}
                      onClick={() => document.getElementById("upload-input").click()}
                    >
                      <UploadCloud className="text-gray-400 mx-auto mb-3" size={32} />
                      <p className="text-sm font-medium text-gray-600">Drag & drop images or click to upload</p>
                      <input type="file" multiple id="upload-input" className="hidden" accept="image/*" onChange={(e) => onPickFiles(e.target.files)} />
                    </div>
                    {errors.images && <p className="text-[9px] font-black text-red-500 uppercase mt-1 text-center">{errors.images}</p>}
                    {imagePreviews.length > 0 && (
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={handleUploadImages} disabled={uploading} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-md">
                          {uploading ? "Uploading..." : `Upload ${imagePreviews.length} items`}
                        </button>
                        <button type="button" onClick={() => { setSelectedFiles([]); setImagePreviews([]); }} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg font-semibold hover:bg-gray-200 transition">
                           Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Product video (optional)</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                      <input
                        type="file"
                        accept="video/*"
                        className="text-sm text-gray-600"
                        onChange={(e) => onPickVideo(e.target.files?.[0] || null)}
                      />
                      {(videoFile || videoPreview) && (
                        <div className="flex gap-2">
                           <button
                             type="button"
                             onClick={handleUploadVideo}
                             disabled={videoUploading}
                             className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                           >
                             {videoUploading ? "Uploading…" : "Confirm video upload"}
                           </button>
                           <button
                             type="button"
                             onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                             className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200"
                           >
                               Clear
                           </button>
                        </div>
                      )}
                    </div>
                    {videoPreview ? (
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Local preview (Unsaved)</p>
                          <video src={videoPreview} controls className="w-full max-h-56 rounded-lg bg-black border-2 border-indigo-500" />
                       </div>
                    ) : formData.video ? (
                      <video src={formData.video} controls className="w-full max-h-56 rounded-lg bg-black" playsInline preload="metadata" />
                    ) : (
                      <p className="text-xs text-gray-400">Optional short clip for this item.</p>
                    )}
                  </div>

                  {/* SUBMIT */}
                  <div className="pt-4">
                     <button type="submit" disabled={saving} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-md hover:shadow-lg">
                       {saving ? "Saving..." : "Save item"}
                     </button>
                  </div>
                </form>

                {/* VISUAL MONITOR SIDEBAR */}
                <div className="lg:col-span-2">
                  <div className="sticky top-6 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Image Setup</h3>
                      
                      {/* PENDING LOCAL PREVIEWS */}
                      {imagePreviews.length > 0 && (
                        <div className="space-y-4 mb-8">
                           <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Pending Upload ({imagePreviews.length})</p>
                           <div className="grid grid-cols-2 gap-2">
                              {imagePreviews.map((url, idx) => (
                                <div key={idx} className="relative rounded-lg overflow-hidden border-2 border-indigo-500 shadow-sm aspect-square">
                                   <img src={url} className="w-full h-full object-cover opacity-75" alt="pending" />
                                   <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/20 backdrop-blur-[1px]">
                                      <Zap className="text-white drop-shadow-md" size={24} />
                                   </div>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}

                      {formData.images.length > 0 ? (
                        <div className="space-y-4">
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live Assets ({formData.images.length})</p>
                           {formData.images.map((url, idx) => (
                            <div key={idx} className="relative rounded-xl overflow-hidden shadow-sm border border-gray-100 group">
                              <img src={url} className="w-full aspect-square object-cover" alt="product" />
                              <button type="button" onClick={() => removeImage(idx)} className="absolute top-2 right-2 h-8 w-8 bg-white/95 backdrop-blur-sm rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition shadow-sm border border-gray-100">
                                 <X size={16} strokeWidth={2.5} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : imagePreviews.length === 0 && (
                        <div className="aspect-square rounded-xl bg-gray-50 border border-gray-200 flex flex-col items-center justify-center text-gray-400">
                           <ImageIcon size={32} className="mb-2 text-gray-300" />
                           <span className="text-sm font-medium">No images uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}