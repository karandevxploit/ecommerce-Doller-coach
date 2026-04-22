import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, Image as ImageIcon, Save, Eye, EyeOff,
  ArrowUp, ArrowDown, Calendar, CheckCircle2,
  Layout, Monitor, UploadCloud
} from "lucide-react";
import { useSiteContentStore } from "../../store/siteContentStore";
import { resolveImageUrl } from "../../utils/url";
import { api } from "../../api/client";
import toast from "react-hot-toast";

export default function SiteContentManager() {
  const {
    previewContent,
    isPreviewMode,
    updatePreview,
    setPreviewMode,
    resetPreview,
    updateContent,
    fetchContent
  } = useSiteContentStore();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");

  const blobUrlsRef = useRef(new Set());
  const uploadLock = useRef(false);

  // ✅ SAFE FETCH
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // ✅ SAVE WITH ERROR SAFETY
  const handleSave = async () => {
    try {
      setLoading(true);
      const success = await updateContent(previewContent);

      if (success) {
        setPreviewMode(false);
        toast.success("Content updated");
      } else {
        throw new Error("Update failed");
      }
    } catch (err) {
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED IMAGE UPLOAD (NO DUPLICATE / SAFE RESPONSE)
  const handleImageUpload = async (e, type, index = null) => {
    const file = e.target.files?.[0];
    if (!file || uploadLock.current) return;

    uploadLock.current = true;

    const localUrl = URL.createObjectURL(file);
    blobUrlsRef.current.add(localUrl);

    // instant preview
    if (type === "hero") {
      const slides = [...(previewContent.heroCarousel || [])];
      slides[index] = { ...slides[index], image: localUrl };
      updatePreview({ heroCarousel: slides });
    }

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await api.post("/uploads/single", formData);

      const imageUrl =
        res?.data?.imageUrl ||
        res?.data?.file?.url ||
        res?.data?.url ||
        res?.data?.secure_url;

      if (!imageUrl) throw new Error("Invalid upload response");

      // replace preview with actual
      if (type === "hero") {
        const slides = [...(previewContent.heroCarousel || [])];
        slides[index] = { ...slides[index], image: imageUrl };
        updatePreview({ heroCarousel: slides });
      }

      toast.success("Uploaded");

    } catch (err) {
      toast.error("Upload failed");
    } finally {
      uploadLock.current = false;
    }
  };

  // ✅ CLEANUP MEMORY LEAK
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
    };
  }, []);

  // ✅ SAFE SLIDE OPS
  const addSlide = () => {
    const slides = previewContent.heroCarousel || [];

    if (slides.length >= 5) return toast.error("Max 5 slides");

    updatePreview({
      heroCarousel: [
        ...slides,
        {
          image: "",
          heading: "New Drop",
          subheading: "Collection",
          offer: { enabled: false },
        },
      ],
    });
  };

  const deleteSlide = (i) => {
    const slides = previewContent.heroCarousel.filter((_, idx) => idx !== i);
    updatePreview({ heroCarousel: slides });
  };

  const updateSlide = (i, data) => {
    const slides = [...previewContent.heroCarousel];
    slides[i] = { ...slides[i], ...data };
    updatePreview({ heroCarousel: slides });
  };

  const reorderSlide = (i, dir) => {
    const slides = [...previewContent.heroCarousel];

    if (dir === "up" && i > 0) {
      [slides[i], slides[i - 1]] = [slides[i - 1], slides[i]];
    }

    if (dir === "down" && i < slides.length - 1) {
      [slides[i], slides[i + 1]] = [slides[i + 1], slides[i]];
    }

    updatePreview({ heroCarousel: slides });
  };

  return (
    <div className="space-y-8 pb-20 max-w-5xl mx-auto pt-6">

      {/* HEADER VISUAL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase">Site Content</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">Manage and preview homepage sections live</p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setPreviewMode(!isPreviewMode)}
            className={`flex-1 md:flex-none px-4 py-2 ${isPreviewMode ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-700'} text-xs font-bold uppercase tracking-widest rounded-xl transition-all border shadow-sm flex items-center justify-center gap-2`}
          >
            {isPreviewMode ? <EyeOff size={16} /> : <Eye size={16} />}
            {isPreviewMode ? "Exit Preview" : "Live Preview"}
          </button>

          <button 
            onClick={handleSave} 
            disabled={loading}
            className="flex-1 md:flex-none px-6 py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {loading ? "Saving" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl border border-gray-100 overflow-x-auto no-scrollbar">
        {[
          { id: "hero", label: "Hero Carousel", icon: Layout },
          { id: "headings", label: "Section Headings", icon: Monitor },
          { id: "banner", label: "Promo Banner", icon: CheckCircle2 },
          { id: "brand", label: "Brand Asset", icon: ImageIcon }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-gray-900 text-white shadow-md"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        {/* HERO TAB */}
        {activeTab === "hero" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <div>
                <h3 className="text-sm font-black uppercase text-gray-900">Hero Carousel</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest max-w-sm">
                  Add up to 5 strategic slides. Use 16:9 vertical format for best mobile results.
                </p>
              </div>
              <button 
                onClick={addSlide}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-100 transition flex items-center gap-2"
              >
                <Plus size={14} /> Add Slide
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(Array.isArray(previewContent.heroCarousel) ? previewContent.heroCarousel : []).map((slide, i) => (
                <div key={i} className="border border-gray-100 p-5 rounded-2xl bg-gray-50/50 shadow-sm space-y-5 relative group">
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => reorderSlide(i, "up")} className="p-1.5 bg-white rounded-md shadow text-gray-600 hover:text-indigo-600 border"><ArrowUp size={14} /></button>
                    <button onClick={() => reorderSlide(i, "down")} className="p-1.5 bg-white rounded-md shadow text-gray-600 hover:text-indigo-600 border"><ArrowDown size={14} /></button>
                    <button onClick={() => deleteSlide(i)} className="p-1.5 bg-white rounded-md shadow text-rose-500 hover:text-rose-700 border"><Trash2 size={14} /></button>
                  </div>

                  {/* IMAGE UPLOAD UI */}
                  <div className="relative h-48 rounded-xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-200 group/img flex items-center justify-center">
                    {slide.image ? (
                      <>
                        <img 
                          src={resolveImageUrl(slide.image)} 
                          className="absolute inset-0 w-full h-full object-cover opacity-90 transition group-hover/img:opacity-50" 
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 text-white drop-shadow-md cursor-pointer">
                          <UploadCloud size={28} className="mb-2" />
                          <span className="text-xs font-bold uppercase tracking-widest">Replace Imagery</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <UploadCloud size={32} className="mb-3 text-indigo-300" />
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-500">Upload Media</span>
                      </div>
                    )}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-20" onChange={(e) => handleImageUpload(e, "hero", i)} />
                  </div>

                  {/* SLIDE DETAILS */}
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-gray-400">Headline</label>
                        <input value={slide.heading} onChange={(e) => updateSlide(i, { heading: e.target.value })} className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-gray-900" placeholder="e.g. Summer Collection" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black tracking-widest uppercase text-gray-400">Subheading Narrative</label>
                        <input value={slide.subheading || ""} onChange={(e) => updateSlide(i, { subheading: e.target.value })} className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-500" placeholder="Elevate your style with new arrivals" />
                     </div>
                     <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                           <label className="text-[10px] flex items-center gap-2 font-black tracking-widest uppercase text-indigo-600"><Monitor size={12}/> Embedded Offer</label>
                           <input type="checkbox" checked={slide.offer?.enabled} onChange={(e) => updateSlide(i, { offer: { ...slide.offer, enabled: e.target.checked } })} className="accent-indigo-600 w-4 h-4" />
                        </div>
                        {slide.offer?.enabled && (
                          <input value={slide.offer?.text || ""} onChange={(e) => updateSlide(i, { offer: { ...slide.offer, text: e.target.value } })} className="w-full px-4 py-2 text-xs bg-indigo-50/50 border border-indigo-100 rounded-lg outline-none text-indigo-800 font-bold" placeholder="e.g. 50% OFF TODAY" />
                        )}
                     </div>
                  </div>
                </div>
              ))}
            </div>
            {(!Array.isArray(previewContent.heroCarousel) || previewContent.heroCarousel.length === 0) && (
              <div className="py-20 text-center flex flex-col items-center">
                 <Layout size={40} className="text-gray-200 mb-4" />
                 <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">No Slides Active</p>
              </div>
            )}
          </div>
        )}

        {/* HEADINGS TAB */}
        {activeTab === "headings" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase text-gray-900 mb-1">Section Headings</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6 border-b pb-4">
                Redefine architectural section titles across the store.
              </p>
            </div>
            
            {["bestSellersTitle", "trendingTitle", "newArrivalsTitle"].map((key) => (
              <div key={key} className="space-y-2">
                 <label className="text-xs font-black tracking-widest uppercase text-gray-600">
                   {key.replace(/([A-Z])/g, ' $1').trim()}
                 </label>
                 <input 
                   value={previewContent.headings?.[key] || ""} 
                   onChange={(e) => updatePreview({ headings: { ...previewContent.headings, [key]: e.target.value }})}
                   className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:shadow-sm transition-all font-bold" 
                   placeholder="Enter section title"
                 />
              </div>
            ))}
          </div>
        )}

        {/* PROMO BANNER TAB */}
        {activeTab === "banner" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase text-gray-900 mb-1">Promotional Banner</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6 border-b pb-4">
                The global site-wide announcement block.
              </p>
            </div>
            
            <div className="space-y-5">
               <div className="space-y-2">
                  <label className="text-xs font-black tracking-widest uppercase text-gray-600">Primary Announcement</label>
                  <input 
                    value={previewContent.banners?.promoBanner?.text || ""} 
                    onChange={(e) => updatePreview({ banners: { promoBanner: { ...previewContent.banners?.promoBanner, text: e.target.value } }})}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold" 
                    placeholder="e.g. MEGA SALE"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-xs font-black tracking-widest uppercase text-gray-600">Subtext Payload</label>
                  <input 
                    value={previewContent.banners?.promoBanner?.subtext || ""} 
                    onChange={(e) => updatePreview({ banners: { promoBanner: { ...previewContent.banners?.promoBanner, subtext: e.target.value } }})}
                    className="w-full px-4 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none" 
                    placeholder="e.g. Free shipping on all orders"
                  />
               </div>
            </div>
          </div>
        )}

        {/* BRAND LOGO TAB */}
        {activeTab === "brand" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-black uppercase text-gray-900 mb-1">Brand Identity</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6 border-b pb-4">
                Upload your primary core logo asset.
              </p>
            </div>
            
            <div className="p-8 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 transition relative group/logo cursor-pointer overflow-hidden max-w-sm mx-auto">
              <input 
                type="file" 
                className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const localUrl = URL.createObjectURL(file);
                  updatePreview({ branding: { logo: { ...previewContent.branding?.logo, url: localUrl } } });
                  
                  try {
                    const formData = new FormData();
                    formData.append("image", file);
                    const res = await api.post("/uploads/single", formData);
                    const imageUrl = res?.data?.imageUrl || res?.data?.file?.url || res?.data?.url || res?.data?.secure_url;
                    
                    if (imageUrl) {
                      updatePreview({ branding: { logo: { url: imageUrl } } });
                      toast.success("Logo synced");
                    }
                  } catch (err) {
                    toast.error("Logo upload failed");
                  }
                }} 
              />
              {previewContent.branding?.logo?.url ? (
                <>
                   <img src={resolveImageUrl(previewContent.branding.logo.url)} className="h-16 object-contain z-10 transition group-hover/logo:opacity-50" />
                   <div className="absolute inset-0 flex items-center justify-center bg-gray-900/10 opacity-0 group-hover/logo:opacity-100 transition text-gray-900 font-bold text-xs tracking-widest uppercase">
                     Change
                   </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <ImageIcon size={32} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Inject Corporate Logo</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}