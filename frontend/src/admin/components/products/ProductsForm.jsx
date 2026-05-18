import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  LayoutGrid, 
  Layers, 
  Zap, 
  Settings, 
  Save, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Upload,
  X,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../../api/client';
import { ENDPOINTS } from '../../../api/endpoints';
import { uploadImage, uploadProductVideo } from '../../../api/upload';
import { FALLBACK_IMAGE_URL, resolveImageUrl, resolveVideoUrl } from '../../../utils/url';
import ProductCard from './ProductCard';
import { SIZE_CHART, CATEGORIES, SUBCATEGORIES } from './constants';

const defaultForm = {
  title: "",
  description: "",
  price: 0,
  originalPrice: 0,
  category: "",
  subcategory: "",
  gender: "men",
  colors: [], // Top-level for filtering
  sizes: [],  // Top-level for filtering
  productType: "",
  variants: [
    {
      color: "",
      colorCode: "#000000",
      images: [],
      sizes: [] // [{ size: 'M', stock: 10 }]
    }
  ],
  status: "draft",
  featured: false,
  trending: false,
  badge: { text: "", color: "#0f172a", enabled: false },
  offer: { title: "", discount: "", couponCode: "", startDate: "", expiryDate: "", enabled: false },
  controls: {
    codAllowed: true,
    showETA: true,
    allowWishlist: true
  },
  video: { url: null, publicId: null, size: 0 }
};

const TABS = [
  { id: 'general', label: 'General', icon: LayoutGrid },
  { id: 'matrix', label: 'Matrix', icon: Layers },
  { id: 'conversion', label: 'Conversion', icon: Zap },
  { id: 'controls', label: 'Controls', icon: Settings },
];

const toDateInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().split('T')[0];
};

const numberInputValue = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric !== 0 ? String(numeric) : "";
};

const parseNumberInput = (value) => {
  if (value === "") return "";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : "";
};

const COLOR_NAME_TO_HEX = {
  black: "#000000",
  white: "#ffffff",
  blue: "#2563eb",
  navy: "#1e3a8a",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#facc15",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#9333ea",
  grey: "#6b7280",
  gray: "#6b7280",
  brown: "#7c2d12",
  beige: "#d6b98c",
  cream: "#f5f5dc",
  maroon: "#7f1d1d",
  olive: "#4d7c0f",
};

const resolveColorHex = (name, fallback = "#000000") => {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return fallback;

  const words = normalized.split(/[\s/_-]+/).filter(Boolean);
  for (const word of words) {
    if (COLOR_NAME_TO_HEX[word]) return COLOR_NAME_TO_HEX[word];
  }

  return COLOR_NAME_TO_HEX[normalized] || fallback;
};

const detectDominantImageColor = (url) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(null);

      ctx.drawImage(img, 0, 0, size, size);
      const pixels = ctx.getImageData(0, 0, size, size).data;
      const scores = {};

      const toColorName = (r, g, b) => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const saturation = max === 0 ? 0 : delta / max;
        const value = max / 255;

        if (saturation < 0.12) {
          if (value < 0.22) return "black";
          if (value > 0.88) return "";
          return "grey";
        }

        let hue = 0;
        if (delta !== 0) {
          if (max === r) hue = ((g - b) / delta) % 6;
          else if (max === g) hue = (b - r) / delta + 2;
          else hue = (r - g) / delta + 4;
          hue *= 60;
          if (hue < 0) hue += 360;
        }

        if (hue < 15 || hue >= 345) return value < 0.42 ? "maroon" : "red";
        if (hue < 45) return value < 0.48 ? "brown" : "orange";
        if (hue < 70) return "yellow";
        if (hue < 165) return value < 0.45 ? "olive" : "green";
        if (hue < 255) return value < 0.38 ? "navy" : "blue";
        if (hue < 290) return "purple";
        if (hue < 345) return value < 0.45 ? "maroon" : "pink";
        return "";
      };

      for (let i = 0; i < pixels.length; i += 4 * 3) {
        const alpha = pixels[i + 3];
        if (alpha < 180) continue;

        const name = toColorName(pixels[i], pixels[i + 1], pixels[i + 2]);
        if (!name) continue;

        scores[name] = (scores[name] || 0) + 1;
      }

      const [name] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] || [];
      resolve(name ? { name, hex: COLOR_NAME_TO_HEX[name] || "#000000" } : null);
    } catch {
      resolve(null);
    }
  };

  img.onerror = () => resolve(null);
  img.src = resolveImageUrl(url);
});

const isUsableImageValue = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return false;

  return (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:image/") ||
    raw.startsWith("blob:") ||
    raw.startsWith("/uploads/") ||
    raw.startsWith("uploads/")
  );
};

const isPersistedImageValue = (value) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return false;

  if (raw.startsWith("/uploads/") || raw.startsWith("uploads/")) return true;

  try {
    const url = new URL(raw);
    return url.pathname.startsWith("/uploads/");
  } catch {
    return false;
  }
};

const normalizeImages = (images) =>
  Array.isArray(images) ? images.filter(isUsableImageValue) : [];

const normalizePersistedImages = (images) =>
  Array.isArray(images) ? [...new Set(images.filter(isPersistedImageValue))] : [];

const normalizeProductForForm = (data) => {
  if (!data) return defaultForm;

  let variants = [];

  if (Array.isArray(data.variants)) {
    // Check if it's already hierarchical [{ color, sizes: [...] }]
    const isHierarchical = data.variants.length > 0 && Array.isArray(data.variants[0].sizes);

    if (isHierarchical) {
      variants = data.variants.map(v => ({
        color: v.color || "",
        colorCode: v.colorCode || "#000000",
        images: normalizeImages(v.images),
        sizes: Array.isArray(v.sizes) ? v.sizes : []
      }));
    } else {
      // Group flat variants by color
      const colorMap = {};
      data.variants.forEach(v => {
        const colorKey = v.color || 'Common';
        if (!colorMap[colorKey]) {
          colorMap[colorKey] = {
            color: v.color,
            colorCode: v.colorCode || '#000000',
            images: isUsableImageValue(v.image) ? [v.image] : [],
            sizes: []
          };
          variants.push(colorMap[colorKey]);
        }
        colorMap[colorKey].sizes.push({
          size: v.size,
          stock: v.stock || 0
        });
        if (v.image && !colorMap[colorKey].images.includes(v.image)) {
          colorMap[colorKey].images.push(v.image);
        }
      });
    }
  }

  return {
    ...defaultForm,
    ...data,
    _id: data._id,
    title: data.name || data.title || "",
    category: data.category?._id || data.category || "",
    subcategory: data.subcategory || "",
    gender: data.gender || "men",
    colors: data.colors || [],
    sizes: data.sizes || [],
    variants: variants.length > 0 ? variants : defaultForm.variants,
    trending: !!data.isTrending,
    offer: {
      title: data.offer?.title || "",
      discount: data.offer?.discount || "",
      couponCode: data.offer?.couponCode || "",
      startDate: toDateInputValue(data.offer?.startDate),
      expiryDate: toDateInputValue(data.offer?.expiryDate),
      enabled: !!data.offer?.isActive || !!data.offer?.enabled || false
    },
    video: typeof data.video === 'string' ? { url: data.video, publicId: null, size: 0 } : (data.video || defaultForm.video)
  };
};

export default function ProductsForm({ initialData, onSuccess, onCancel }) {
  const [formData, setFormData] = useState(() => normalizeProductForForm(initialData));
  const [categories, setCategories] = useState([]);
  const [activeTab, setActiveTab ] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);

  /* ---------------- DERIVED ---------------- */
  const discount = useMemo(() => {
    if (formData.originalPrice <= 0) return 0;
    const diff = formData.originalPrice - formData.price;
    return Math.round((diff / formData.originalPrice) * 100);
  }, [formData.price, formData.originalPrice]);

  const isValid = useMemo(() => {
    const { title, price, category, sizes, variants } = formData;
    
    // Support both ID string and populated object
    const hasCategory = category && (typeof category === 'string' ? category.length > 0 : !!category._id);
    const hasTitle = title && title.trim().length > 0;
    const hasPrice = price > 0;
    const hasSizes = sizes && sizes.length > 0;
    const hasVariants = variants && variants.length > 0 && variants.every(v => v.color && v.sizes.some(s => s.stock >= 0));

    return !!(hasTitle && hasPrice && hasCategory && hasSizes && hasVariants);
  }, [formData]);

  /* ---------------- FETCH CATEGORIES ---------------- */
  useEffect(() => {
    let mounted = true;
    const fetchCats = async () => {
      try {
        const res = await api.get(ENDPOINTS.CATEGORIES.BASE);
        if (res.status !== 200) throw new Error("API failed");
        
        const allCats = res?.data?.data || res?.data || [];
        if (mounted) setCategories(allCats);
      } catch (err) {
        console.error("CAT_LOAD_ERR:", err);
        toast.error("Failed to load category metadata");
      }
    };
    fetchCats();
    return () => { mounted = false; };
  }, []);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => c.gender === formData.gender);
  }, [categories, formData.gender]);

  /* ---------------- DYNAMIC SIZES ---------------- */
  const availableSizes = useMemo(() => {
    const selectedCat = categories.find(c => c._id === formData.category);
    if (selectedCat) return selectedCat.sizes || [];
    
    // Fallback to constants if no category selected
    return SIZE_CHART[formData.subcategory] || [];
  }, [formData.category, formData.subcategory, categories]);

  const updateField = useCallback((path, value) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }, []);

  // Sync global sizes to all variants
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => ({
        ...v,
        sizes: prev.sizes.map(s => {
          const existing = v.sizes.find(es => es.size === s);
          return existing || { size: s, stock: 0 };
        }).filter(s => prev.sizes.includes(s.size))
      }))
    }));
  }, [formData.sizes]);

  const handleSizeToggle = (size) => {
    const newSizes = formData.sizes.includes(size)
      ? formData.sizes.filter(s => s !== size)
      : [...formData.sizes, size];
    updateField('sizes', newSizes);
  };

  const selectAllSizes = () => {
    if (!availableSizes.length) {
      toast.error("Select a category first");
      return;
    }

    updateField('sizes', availableSizes);
    toast.success("All sizes selected");
  };

  const fillVariantStock = (variantIndex) => {
    const input = window.prompt("Enter quantity for all sizes", "1");
    if (input === null) return;

    const quantity = Number(input);
    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("Enter a valid quantity");
      return;
    }

    setFormData(prev => {
      const newVariants = [...prev.variants];
      newVariants[variantIndex] = {
        ...newVariants[variantIndex],
        sizes: newVariants[variantIndex].sizes.map(sizeRow => ({
          ...sizeRow,
          stock: quantity,
        })),
      };
      return { ...prev, variants: newVariants };
    });

    toast.success("Quantity filled for all sizes");
  };

  const buildSku = (variant, index) => {
    const prefix = (formData.title || "PRO").substring(0, 3).toUpperCase();
    const selectedCategory = categories.find(c => c._id === formData.category);
    const cat = String(selectedCategory?.name || formData.category || "CAT").substring(0, 2).toUpperCase();
    const col = (variant.color || `C${index + 1}`).substring(0, 2).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${cat}-${col}-${rand}`;
  };

  const isUploading = useRef(false);

  const handleImageUpload = async (variantIndex, files) => {
    if (isUploading.current) return;
    const file = Array.from(files || []).filter(Boolean)[0];
    if (!file) return;

    isUploading.current = true;
    try {
      toast.loading("Uploading image...", { id: 'upload' });
      const url = await uploadImage(file);
      const detectedColor = await detectDominantImageColor(url);
      
      setFormData(prev => {
        const newVariants = [...prev.variants];
        const currentImages = Array.isArray(newVariants[variantIndex].images)
          ? newVariants[variantIndex].images
          : [];

        if (detectedColor) {
          newVariants[variantIndex].color = detectedColor.name;
          newVariants[variantIndex].colorCode = detectedColor.hex;
        }

        if (!currentImages.includes(url)) {
          newVariants[variantIndex].images = [...currentImages, url];
        }

        return { ...prev, variants: newVariants };
      });
      
      toast.success(detectedColor ? `Image uploaded, ${detectedColor.name} selected` : "Image uploaded", { id: 'upload' });
    } catch (err) {
      console.error("[UPLOAD_ERROR]", err);
      toast.error("Upload failed: " + err.message, { id: 'upload' });
    } finally {
      isUploading.current = false;
    }
  };

  const removeImage = (variantIndex, imgIndex) => {
    setFormData(prev => {
      const newVariants = [...prev.variants];
      newVariants[variantIndex].images = newVariants[variantIndex].images.filter((_, i) => i !== imgIndex);
      return { ...prev, variants: newVariants };
    });
  };

  const generateSKU = (variantIndex) => {
    const newVariants = [...formData.variants];
    newVariants[variantIndex].sku = buildSku(newVariants[variantIndex], variantIndex);
    updateField('variants', newVariants);
    toast.success("SKU Generated");
  };

  const generateAllSkus = () => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map((variant, index) => ({
        ...variant,
        sku: buildSku(variant, index),
      })),
    }));
    toast.success("SKU generated for all variants");
  };

  const addVariant = () => {
    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { 
        color: "", 
        colorCode: "#000000", 
        images: [], 
        sizes: prev.sizes.map(s => ({ size: s, stock: 0 })) 
      }]
    }));
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) return toast.error("Must have at least one variant");
    setFormData(prev => ({
      ...prev,
      variants: formData.variants.filter((_, i) => i !== index)
    }));
  };

  const [videoFile, setVideoFile] = useState(null);

  const handleVideoUpload = (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast.error("Video too large (max 20MB)");
    
    // Create local preview
    const localUrl = URL.createObjectURL(file);
    setVideoFile(file);
    updateField('video', { ...formData.video, url: localUrl, isLocal: true });
    toast.success("Video selected for upload");
  };

  const handleVideoDelete = async () => {
    if (!formData.video?.url) return;
    if (!window.confirm("Remove video?")) return;

    try {
      if (initialData?._id && !formData.video.isLocal) {
         toast.loading("Deleting video...", { id: 'v-del' });
         const res = await api.delete(`/admin/products/${initialData._id}/video`);
         if (res.data.success) {
           updateField('video', { url: null, publicId: null, size: 0 });
           setVideoFile(null);
           toast.success("Video removed", { id: 'v-del' });
         }
      } else {
         updateField('video', { url: null, publicId: null, size: 0 });
         setVideoFile(null);
      }
    } catch (err) {
      toast.error("Failed to delete video");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current) return;
    if (!isValid) return toast.error("Please complete the form properly");

    setSaveError("");
    savingRef.current = true;
    setIsSaving(true);
    toast.loading(initialData?._id ? "Updating product..." : "Creating product...", { id: 'save' });

    try {
      // 1. UPLOAD VIDEO FIRST (IF LOCAL)
      let finalVideoUrl = formData.video?.url || "";
      if (videoFile) {
        const vResult = await uploadProductVideo(videoFile);
        finalVideoUrl = vResult.url;
      }

      // 2. CONSTRUCT CLEAN JSON PAYLOAD
      const allImages = formData.variants.flatMap(v => v.images);
      const cleanImages = normalizePersistedImages(allImages);

      if (!cleanImages.length) {
        throw new Error("Please upload at least one product image before saving");
      }
      
      const fullPayload = {
        name: formData.title,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory || "",
        gender: formData.gender,
        colors: [...new Set(formData.variants.map(v => v.color).filter(Boolean))],
        sizes: formData.sizes,
        productType: formData.productType || "standard",
        price: Number(formData.price),
        originalPrice: Number(formData.originalPrice),
        images: cleanImages,
        primaryImage: cleanImages[0] || "",
        hoverImage: cleanImages[1] || cleanImages[0] || "",
        variants: formData.variants.map(v => ({
          color: v.color,
          colorCode: v.colorCode,
          sku: v.sku || "",
          images: normalizePersistedImages(v.images),
          sizes: v.sizes.map(s => ({
            size: s.size,
            stock: Number(s.stock) || 0
          }))
        })),
        status: formData.status,
        featured: !!formData.featured,
        isTrending: !!formData.trending,
        isBestSeller: !!formData.isBestSeller,
        badge: formData.badge,
        offer: formData.offer,
        controls: formData.controls,
        video: finalVideoUrl // Send as string
      };

      const method = initialData?._id ? 'put' : 'post';
      const endpoint = initialData?._id ? `/admin/products/${initialData._id}` : '/admin/products';

      const res = await api[method](endpoint, fullPayload);
      
      if (res.data.success) {
        toast.success(initialData?._id ? "Product updated!" : "Product created!", { id: 'save' });
        onSuccess?.();
      } else {
        const message = res.data.message || "Failed to save product";
        setSaveError(message);
        toast.error(message, { id: 'save' });
      }
    } catch (err) {
      console.error("[PRODUCT_SUBMIT_ERROR]", err);
      const errorMsg =
        err.response?.data?.message ||
        (err.code === "BACKEND_UNREACHABLE"
          ? "Backend connection failed. Please check that the API server is running."
          : err.message) ||
        "Operation failed";
      setSaveError(errorMsg);
      toast.error(errorMsg, { id: 'save' });
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  // --------------------------------------------------------------------------
  // RENDER HELPERS
  // --------------------------------------------------------------------------

  const renderTab = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Name</label>
                <input 
                  type="text"
                  value={formData.title}
                  onChange={e => updateField('title', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  placeholder="e.g. Premium Oversized Tee"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</label>
                <select 
                  value={formData.gender || 'unisex'}
                  onChange={e => updateField('gender', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                >
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                <select 
                  value={formData.category}
                  onChange={e => {
                    updateField('category', e.target.value);
                    updateField('sizes', []); 
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                >
                  <option value="">Select Category</option>
                  {filteredCategories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pricing (MRP)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input 
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={numberInputValue(formData.originalPrice)}
                    onChange={e => updateField('originalPrice', parseNumberInput(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selling Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input 
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={numberInputValue(formData.price)}
                    onChange={e => updateField('price', parseNumberInput(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                Available Sizes
                <button
                  type="button"
                  onClick={selectAllSizes}
                  className="text-[9px] text-indigo-600 font-black uppercase tracking-widest hover:text-slate-900"
                >
                  Select All
                </button>
              </label>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => handleSizeToggle(sz)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      formData.sizes.includes(sz) 
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => updateField('description', e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium min-h-[120px]"
                placeholder="Product narrative..."
              />
            </div>

            {/* VIDEO SECTION */}
            <div className="p-8 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30 space-y-4">
               <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Product Video</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Optional 20MB Max • MP4/WEBM</p>
                  </div>
                  {formData.video?.url && (
                    <button 
                      type="button" 
                      onClick={handleVideoDelete}
                      className="p-2 bg-white text-rose-500 rounded-xl shadow-lg border border-slate-100 hover:bg-rose-50 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
               </div>

               {formData.video?.url ? (
                 <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl border border-white">
                    <video 
                      src={resolveVideoUrl(formData.video.url)} 
                      className="w-full h-full object-cover"
                      controls
                    />
                 </div>
               ) : (
                 <label className="flex flex-col items-center justify-center py-10 bg-white border border-slate-100 rounded-3xl cursor-pointer hover:bg-slate-50 transition-all group">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-4 shadow-xl group-hover:scale-110 transition-transform">
                       <Upload size={20} />
                    </div>
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Upload Cinematic Clip</span>
                    <span className="text-[10px] text-slate-400 mt-1">Enhance conversion by 35%</span>
                    <input 
                      type="file" 
                      accept="video/mp4,video/webm" 
                      className="hidden" 
                      onChange={e => handleVideoUpload(e.target.files[0])}
                    />
                 </label>
               )}
            </div>
          </div>
        );

      case 'matrix':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Variant Matrix</h3>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={generateAllSkus}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-900 rounded-xl text-xs font-bold hover:border-slate-900 transition-all"
                >
                  <RefreshCcw size={14} /> SKU All
                </button>
                <button 
                  type="button" 
                  onClick={addVariant}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Plus size={14} /> Add Color
                </button>
              </div>
            </div>

            <div className="space-y-12">
              {formData.variants.map((variant, vIdx) => (
                <div key={vIdx} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-lg shadow-slate-100/50 space-y-5 group relative">
                  <button 
                    type="button"
                    onClick={() => removeVariant(vIdx)}
                    className="absolute -top-3 -right-3 p-2 bg-white text-rose-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 border border-slate-100"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Color Name</label>
                        <input 
                          type="text"
                          value={variant.color}
                          onChange={e => {
                            const colorName = e.target.value;
                            const newVariants = [...formData.variants];
                            newVariants[vIdx].color = colorName;
                            newVariants[vIdx].colorCode = resolveColorHex(colorName, newVariants[vIdx].colorCode || "#000000");
                            updateField('variants', newVariants);
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                          placeholder="e.g. Jet Black"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Color Hex</label>
                        <div className="flex gap-4 items-center">
                          <input 
                            type="color"
                            value={variant.colorCode}
                            onChange={e => {
                              const newVariants = [...formData.variants];
                              newVariants[vIdx].colorCode = e.target.value;
                              updateField('variants', newVariants);
                            }}
                            className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                          />
                          <span className="text-xs font-mono font-bold text-slate-500 uppercase">{variant.colorCode}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                          SKU
                          <button 
                            type="button" 
                            onClick={() => generateSKU(vIdx)}
                            className="text-slate-900 hover:underline"
                          >
                            Auto-Generate
                          </button>
                        </label>
                        <input 
                          type="text"
                          value={variant.sku || ""}
                          onChange={e => {
                            const newVariants = [...formData.variants];
                            newVariants[vIdx].sku = e.target.value;
                            updateField('variants', newVariants);
                          }}
                          className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 transition-all font-mono text-xs"
                          placeholder="SKU-XXXX-XXXX"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between">
                        Stock per Size
                        <button
                          type="button"
                          onClick={() => fillVariantStock(vIdx)}
                          className="text-[9px] text-indigo-600 font-black uppercase tracking-widest hover:text-slate-900"
                        >
                          Fill All Qty
                        </button>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {variant.sizes.map((sz, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl">
                            <span className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-[10px] font-black">{sz.size}</span>
                            <input 
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={numberInputValue(sz.stock)}
                              onChange={e => {
                                const newVariants = [...formData.variants];
                                newVariants[vIdx].sizes[sIdx].stock = parseNumberInput(e.target.value);
                                updateField('variants', newVariants);
                              }}
                              className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 p-0"
                              placeholder="Qty"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Images</label>
                    <div className="grid grid-cols-4 gap-4">
                      {variant.images.map((img, iIdx) => {
                        const finalUrl = resolveImageUrl(img);
                        return (
                          <div key={iIdx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group/img shadow-sm hover:shadow-md transition-all">
                            <img 
                              src={finalUrl} 
                              alt={`Product ${iIdx}`} 
                              className="w-full h-full object-cover" 
                              onError={(e) => {
                                console.error(">>> [IMAGE_LOAD_FAIL]", finalUrl);
                                e.currentTarget.src = FALLBACK_IMAGE_URL;
                              }}
                            />
                            <button 
                              type="button"
                              onClick={() => removeImage(vIdx, iIdx)}
                              className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-all hover:bg-black"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-slate-900 hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-900 group/upload">
                        <Upload size={20} className="mb-2 group-hover/upload:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Upload</span>
                        <input 
                          type="file" 
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="hidden" 
                          onChange={e => {
                            handleImageUpload(vIdx, e.target.files);
                            e.target.value = "";
                          }} 
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'conversion':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 flex items-center justify-between">
              <div>
                <h4 className="text-emerald-900 font-bold mb-1">Discount Optimization</h4>
                <p className="text-emerald-700 text-xs">Current discount: <span className="font-bold">{discount}%</span></p>
              </div>
              {discount > 50 && (
                <div className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest animate-bounce">
                  Hot Deal Active
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Promotional Badge</label>
                    <input 
                      type="checkbox"
                      checked={formData.badge.enabled}
                      onChange={e => updateField('badge.enabled', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                  </div>
                  <input 
                    type="text"
                    disabled={!formData.badge.enabled}
                    value={formData.badge.text}
                    onChange={e => updateField('badge.text', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50"
                    placeholder="e.g. NEW ARRIVAL"
                  />
                  <div className="flex items-center gap-4 mt-2">
                    <input 
                      type="color"
                      disabled={!formData.badge.enabled}
                      value={formData.badge.color}
                      onChange={e => updateField('badge.color', e.target.value)}
                      className="w-10 h-10 rounded-xl cursor-pointer border-none bg-transparent"
                    />
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Badge Color</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Special Offer</label>
                    <input 
                      type="checkbox"
                      checked={formData.offer.enabled}
                      onChange={e => updateField('offer.enabled', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                  </div>
                  <input 
                    type="text"
                    disabled={!formData.offer.enabled}
                    value={formData.offer.title}
                    onChange={e => updateField('offer.title', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50"
                    placeholder="Offer Title (e.g. BUY 2 GET 1 FREE)"
                  />
                  <input 
                    type="text"
                    disabled={!formData.offer.enabled}
                    value={formData.offer.discount}
                    onChange={e => updateField('offer.discount', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50 mt-2"
                    placeholder="Discount (e.g. 50% OFF)"
                  />
                  <input 
                    type="text"
                    disabled={!formData.offer.enabled}
                    value={formData.offer.couponCode}
                    onChange={e => updateField('offer.couponCode', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50 mt-2"
                    placeholder="Coupon Code (e.g. SUMMER50)"
                  />
                  <div className="flex gap-4 mt-2">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date</label>
                      <input 
                        type="date"
                        disabled={!formData.offer.enabled}
                        value={formData.offer.startDate}
                        onChange={e => updateField('offer.startDate', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expiry Date</label>
                      <input 
                        type="date"
                        disabled={!formData.offer.enabled}
                        value={formData.offer.expiryDate}
                        onChange={e => updateField('offer.expiryDate', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'controls':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Visibility & Curation</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Status', field: 'status', options: ['draft', 'active'] },
                    { label: 'Featured Product', field: 'featured', type: 'toggle' },
                    { label: 'Trending', field: 'trending', type: 'toggle' },
                    { label: 'Best Seller', field: 'isBestSeller', type: 'toggle' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <span className="text-sm font-bold text-slate-700">{item.label}</span>
                      {item.type === 'toggle' ? (
                        <button 
                          type="button"
                          onClick={() => updateField(item.field, !formData[item.field])}
                          className={`w-12 h-6 rounded-full transition-all relative ${formData[item.field] ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData[item.field] ? 'right-1' : 'left-1'}`} />
                        </button>
                      ) : (
                        <select 
                          value={formData[item.field]}
                          onChange={e => updateField(item.field, e.target.value)}
                          className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
                        >
                          {item.options.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">E-commerce Features</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Allow COD', field: 'controls.codAllowed' },
                    { label: 'Show Estimated Delivery', field: 'controls.showETA' },
                    { label: 'Allow Wishlist', field: 'controls.allowWishlist' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <span className="text-sm font-bold text-slate-700">{item.label}</span>
                      <button 
                        type="button"
                        onClick={() => updateField(item.field, !item.field.split('.').reduce((acc, curr) => acc[curr], formData))}
                        className={`w-12 h-6 rounded-full transition-all relative ${item.field.split('.').reduce((acc, curr) => acc[curr], formData) ? 'bg-slate-900' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${item.field.split('.').reduce((acc, curr) => acc[curr], formData) ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full gap-8 p-8 bg-slate-50 overflow-hidden">
      {/* LEFT FORM AREA */}
      <div className="flex-1 overflow-y-auto pr-4 scrollbar-hide">
        <form onSubmit={handleSubmit} className="admin-card space-y-6 p-4 md:p-6">
          {/* Header & Tabs */}
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="admin-heading">
                  {initialData?._id ? "Edit Product" : "Create Product"}
                </h1>
                <p className="text-slate-400 font-medium mt-1">Configure your product catalog item</p>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={onCancel}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !isValid}
                  className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isSaving ? <RefreshCcw className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>{initialData?._id ? "Update Product" : "Launch Product"}</span>
                </button>
              </div>
            </div>

            <nav className="flex gap-2 p-1.5 bg-slate-100/50 rounded-xl w-fit">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-white text-slate-900 shadow-xl shadow-slate-200/50' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Validation Status Bar */}
          {!isValid && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl animate-pulse">
              <AlertCircle size={18} className="text-amber-600" />
              <p className="text-[10px] font-bold text-amber-900 uppercase tracking-widest">
                Missing required fields: {
                  [!formData.title && "Title", formData.price <= 0 && "Price", formData.sizes.length === 0 && "Sizes", formData.variants.some(v => !v.color || v.images.length === 0) && "Variants Data"].filter(Boolean).join(", ")
                }
              </p>
            </div>
          )}

          {saveError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
              <AlertCircle size={18} className="text-red-600 mt-0.5" />
              <div>
                <p className="text-[10px] font-black text-red-900 uppercase tracking-widest">
                  Product save failed
                </p>
                <p className="text-xs font-bold text-red-700 mt-1">{saveError}</p>
              </div>
            </div>
          )}

          <div className="pt-4">
            {renderTab()}
          </div>
        </form>
      </div>

      {/* RIGHT PREVIEW PANEL */}
      <aside className="w-[420px] sticky top-8 h-fit space-y-8">
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-slate-800 rounded-full blur-3xl opacity-50" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                <Zap size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-tight">Live Pulse</h2>
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Storefront Preview</p>
              </div>
            </div>

            <div className="flex justify-center py-4">
              <ProductCard product={formData} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <p className="text-[8px] uppercase font-bold tracking-[0.2em] text-white/30 mb-1">Visibility</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${formData.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                  <span className="text-xs font-black uppercase">{formData.status}</span>
                </div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-sm">
                <p className="text-[8px] uppercase font-bold tracking-[0.2em] text-white/30 mb-1">Variants</p>
                <span className="text-xl font-black">{formData.variants.length}</span>
                <span className="ml-1 text-[10px] font-bold text-white/30">SKUs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Tips */}
        <div className="bg-white rounded-[2rem] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-start gap-4">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={16} className="text-amber-500" />
          </div>
          <div className="space-y-1">
            <h5 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Growth Pro-Tip</h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Adding <span className="font-bold text-slate-900">at least 3 images</span> per variant increases conversion by 24%. High quality shots make the difference.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
