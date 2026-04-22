import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { uploadMultipleImages } from '../../../api/upload';
import ProductCard from './ProductCard';
import { SIZE_CHART, CATEGORIES, SUBCATEGORIES } from './constants';

const defaultForm = {
  title: "",
  description: "",
  price: 0,
  originalPrice: 0,
  category: "men",
  subcategory: "topwear",
  productType: "",
  sizes: [],
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
  offer: { text: "", enabled: false },
  controls: {
    codAllowed: true,
    showETA: true,
    allowWishlist: true
  }
};

const TABS = [
  { id: 'general', label: 'General', icon: LayoutGrid },
  { id: 'matrix', label: 'Matrix', icon: Layers },
  { id: 'conversion', label: 'Conversion', icon: Zap },
  { id: 'controls', label: 'Controls', icon: Settings },
];

const normalizeProductForForm = (data) => {
  if (!data) return defaultForm;

  // 1. Group flat variants by color
  const groupedVariants = [];
  const colorMap = {};

  (data.variants || []).forEach(v => {
    const colorKey = v.color || 'Common';
    if (!colorMap[colorKey]) {
      colorMap[colorKey] = {
        color: v.color,
        colorCode: v.colorCode || '#000000',
        images: v.image ? [v.image] : [],
        sizes: []
      };
      groupedVariants.push(colorMap[colorKey]);
    }
    colorMap[colorKey].sizes.push({
      size: v.size,
      stock: v.stock || 0
    });
    // Ensure we don't duplicate primary images if already present
    if (v.image && !colorMap[colorKey].images.includes(v.image)) {
      colorMap[colorKey].images.push(v.image);
    }
  });

  // 2. Extract unique sizes
  const allSizes = [...new Set((data.variants || []).map(v => v.size))];

  return {
    ...defaultForm,
    ...data,
    _id: data._id,
    title: data.name || data.title || "",
    category: typeof data.category === 'object' ? (data.category?.main || 'men').toLowerCase() : data.category,
    sizes: allSizes,
    variants: groupedVariants.length > 0 ? groupedVariants : defaultForm.variants,
    trending: !!data.isTrending
  };
};

export default function ProductsForm({ initialData, onSuccess, onCancel }) {
  const [formData, setFormData] = useState(() => normalizeProductForForm(initialData));
  const [activeTab, setActiveTab ] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [previews, setPreviews] = useState({}); // { variantIndex: [urls] }

  // --------------------------------------------------------------------------
  // DERIVED STATE & MEMOS
  // --------------------------------------------------------------------------

  const discount = useMemo(() => {
    if (formData.originalPrice <= 0) return 0;
    const diff = formData.originalPrice - formData.price;
    return Math.round((diff / formData.originalPrice) * 100);
  }, [formData.price, formData.originalPrice]);

  const isValid = useMemo(() => {
    const { title, price, category, sizes, variants } = formData;
    if (!title || price <= 0 || !category || sizes.length === 0 || variants.length === 0) return false;
    
    // Check variants
    return variants.every(v => 
      v.color && 
      v.images.length > 0 && 
      v.sizes.length > 0
    );
  }, [formData]);

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

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

  const handleImageUpload = async (variantIndex, files) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    // Create local previews
    const localPreviews = fileList.map(f => URL.createObjectURL(f));
    setPreviews(prev => ({ ...prev, [variantIndex]: [...(prev[variantIndex] || []), ...localPreviews] }));

    try {
      toast.loading("Uploading images...", { id: 'upload' });
      const urls = await uploadMultipleImages(fileList);
      
      setFormData(prev => {
        const newVariants = [...prev.variants];
        newVariants[variantIndex].images = [...newVariants[variantIndex].images, ...urls];
        return { ...prev, variants: newVariants };
      });
      
      toast.success("Uploaded successfully", { id: 'upload' });
    } catch (err) {
      toast.error("Upload failed", { id: 'upload' });
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
    const { title, category, subcategory, variants } = formData;
    const variant = variants[variantIndex];
    const prefix = title.substring(0, 3).toUpperCase();
    const cat = category.substring(0, 1).toUpperCase();
    const sub = subcategory.substring(0, 2).toUpperCase();
    const col = (variant.color || "XX").substring(0, 2).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    
    const sku = `${prefix}-${cat}${sub}-${col}-${rand}`;
    
    const newVariants = [...formData.variants];
    newVariants[variantIndex].sku = sku;
    updateField('variants', newVariants);
    toast.success("SKU Generated");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return toast.error("Please complete the form properly");

    setIsSaving(true);

    try {
      // 1. DATA TRANSFORMATION: Flatten grouped color-variants into the flat schema Mongoose expects
      // Mongoose expects: variants: [{ sku, color, size, price, stock, image }]
      const allImages = formData.variants.flatMap(v => v.images);
      
      const flatVariants = formData.variants.flatMap(v => 
        v.sizes.map(sz => {
          const baseSku = v.sku || `${formData.title.substring(0, 3).toUpperCase()}-${(v.color || 'XX').substring(0, 2).toUpperCase()}`;
          // Generate ultra-unique SKU for each variant to prevent 409 Conflict
          const uniqueSku = `${baseSku}-${sz.size}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
          return {
            sku: uniqueSku,
            color: v.color,
            size: sz.size,
            price: Number(formData.price) || 0,
            stock: Number(sz.stock) || 0,
            image: v.images[0] || ""
          };
        })
      ).filter(v => v.size);

      // 2. PARTIAL UPDATE LOGIC (SMART PATCH)
      const getPayload = () => {
        const fullPayload = {
          name: formData.title,
          description: formData.description,
          category: typeof formData.category === 'object' ? (formData.category?.main || "men").toLowerCase() : formData.category,
          subcategory: formData.subcategory,
          productType: formData.productType,
          price: Number(formData.price),
          originalPrice: Number(formData.originalPrice),
          images: allImages,
          primaryImage: allImages[0] || "",
          hoverImage: allImages[1] || allImages[0] || "",
          variants: flatVariants,
          status: formData.status,
          featured: !!formData.featured,
          isTrending: !!formData.trending,
          stock: flatVariants.reduce((sum, v) => sum + v.stock, 0),
          badge: formData.badge,
          offer: formData.offer,
          controls: formData.controls
        };

        if (!initialData?._id) return fullPayload;

        // Perform shallow diff for partial update
        const changes = {};
        const original = normalizeProductForForm(initialData);

        Object.keys(fullPayload).forEach(key => {
          // Special handling for nested objects/arrays (simple JSON check)
          if (JSON.stringify(fullPayload[key]) !== JSON.stringify(original[key])) {
             changes[key] = fullPayload[key];
          }
        });

        // Always ensure we have some data
        return Object.keys(changes).length > 0 ? changes : null;
      };

      const payload = getPayload();

      if (initialData?._id && !payload) {
        setIsSaving(false);
        return onCancel(); // No changes made
      }

      console.log("[AXIOS] SENDING PAYLOAD:", JSON.stringify(payload, null, 2));

      const method = initialData?._id ? 'put' : 'post';
      const endpoint = initialData?._id ? `/admin/products/${initialData._id}` : '/admin/products';
      
      const res = await api[method](endpoint, payload);
      
      if (res.data.success) {
        toast.success(initialData?._id ? "Product updated!" : "Product created!");
        onSuccess?.();
      } else {
        toast.error(res.data.message || "Failed to save product");
      }
    } catch (err) {
      console.error("[PRODUCT_SUBMIT_ERROR]", err);
      const errorMsg = err.response?.data?.message || err.message || "Operation failed";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
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
            <div className="grid grid-cols-2 gap-6">
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
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Type</label>
                <input 
                  type="text"
                  value={formData.productType}
                  onChange={e => updateField('productType', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  placeholder="e.g. Cotton Blend"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                <select 
                  value={typeof formData.category === 'object' ? formData.category?.main?.toLowerCase() || 'men' : formData.category || 'men'}
                  onChange={e => updateField('category', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                >
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subcategory</label>
                <select 
                  value={formData.subcategory}
                  onChange={e => updateField('subcategory', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                >
                  {(() => {
                    const catString = typeof formData.category === 'object' 
                      ? formData.category?.main?.toLowerCase() || 'men' 
                      : formData.category || 'men';
                    return (SUBCATEGORIES[catString] || []).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>);
                  })()}
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
                    value={formData.originalPrice}
                    onChange={e => updateField('originalPrice', Number(e.target.value))}
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
                    value={formData.price}
                    onChange={e => updateField('price', Number(e.target.value))}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Sizes</label>
              <div className="flex flex-wrap gap-2">
                {(SIZE_CHART[formData.subcategory] || []).map(sz => (
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
          </div>
        );

      case 'matrix':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Variant Matrix</h3>
              <button 
                type="button" 
                onClick={addVariant}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg"
              >
                <Plus size={14} /> Add Color
              </button>
            </div>

            <div className="space-y-12">
              {formData.variants.map((variant, vIdx) => (
                <div key={vIdx} className="p-8 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl shadow-slate-100/50 space-y-8 group relative">
                  <button 
                    type="button"
                    onClick={() => removeVariant(vIdx)}
                    className="absolute -top-3 -right-3 p-2 bg-white text-rose-500 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 border border-slate-100"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Color Name</label>
                        <input 
                          type="text"
                          value={variant.color}
                          onChange={e => {
                            const newVariants = [...formData.variants];
                            newVariants[vIdx].color = e.target.value;
                            updateField('variants', newVariants);
                          }}
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium"
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
                            className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
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
                          className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-mono text-xs"
                          placeholder="SKU-XXXX-XXXX"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Stock per Size</label>
                      <div className="grid grid-cols-2 gap-2">
                        {variant.sizes.map((sz, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl">
                            <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-[10px] font-black">{sz.size}</span>
                            <input 
                              type="number"
                              value={sz.stock}
                              onChange={e => {
                                const newVariants = [...formData.variants];
                                newVariants[vIdx].sizes[sIdx].stock = Number(e.target.value);
                                updateField('variants', newVariants);
                              }}
                              className="w-full bg-transparent border-none text-xs font-bold focus:ring-0 p-0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Images</label>
                    <div className="grid grid-cols-4 gap-4">
                      {variant.images.map((img, iIdx) => (
                        <div key={iIdx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group/img shadow-sm hover:shadow-md transition-all">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <button 
                            type="button"
                            onClick={() => removeImage(vIdx, iIdx)}
                            className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-all hover:bg-black"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-slate-900 hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-900 group/upload">
                        <Upload size={20} className="mb-2 group-hover/upload:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Upload</span>
                        <input 
                          type="file" 
                          multiple 
                          className="hidden" 
                          onChange={e => handleImageUpload(vIdx, e.target.files)} 
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
                    value={formData.offer.text}
                    onChange={e => updateField('offer.text', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all font-medium disabled:opacity-50"
                    placeholder="e.g. BUY 2 GET 1 FREE"
                  />
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
        <form onSubmit={handleSubmit} className="space-y-8 bg-white rounded-[3rem] p-10 shadow-2xl shadow-slate-200/50">
          {/* Header & Tabs */}
          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  {initialData?._id ? "Edit Product" : "Create Product"}
                </h1>
                <p className="text-slate-400 font-medium mt-1">Configure your product catalog item</p>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={onCancel}
                  className="px-6 py-3 border border-slate-200 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !isValid}
                  className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-sm font-extrabold flex items-center gap-2 shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isSaving ? <RefreshCcw className="animate-spin" size={18} /> : <Save size={18} />}
                  <span>{initialData?._id ? "Update Product" : "Launch Product"}</span>
                </button>
              </div>
            </div>

            <nav className="flex gap-2 p-2 bg-slate-100/50 rounded-2xl w-fit">
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
