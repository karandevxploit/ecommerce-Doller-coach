import { useState, useEffect } from "react";
import { useConfigStore } from "../../store/configStore";
import { Upload, Save, Building2, Phone, Mail, FileText, MapPin, CheckCircle2 } from "lucide-react";
import Button from "../../components/ui/Button";
import toast from "react-hot-toast";

export default function Settings() {
  const { config, fetchConfig, updateConfig, uploadLogo } = useConfigStore();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [formData, setFormData] = useState({
    company_name: "",
    phone: "",
    email: "",
    gst: "",
    address: "",
  });

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      setFormData({
        company_name: config.company_name || "",
        phone: config.phone || "",
        email: config.email || "",
        gst: config.gst || "",
        address: config.address || "",
      });
      setLogoPreview(config.logo || "");
    }
  }, [config]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateLogo = async () => {
    if (!logoFile) return toast.error("Please select a file first");
    setLoading(true);
    try {
      await uploadLogo(logoFile);
      toast.success("Logo updated successfully");
      setLogoFile(null);
    } catch {
      toast.error("Logo upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateConfig(formData);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="border-b border-[#F2F2F2] pb-6">
        <h1 className="text-3xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">
           Brand identity settings
        </h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3">
          Manage global branding assets and corporate identifiers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LOGO BOX */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#F2F2F2] shadow-sm">
            <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-widest mb-6">Logo manifest</h3>
            
            <div className="aspect-square rounded-2xl bg-[#f1f5f9] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
              {logoPreview ? (
                <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-8" />
              ) : (
                <div className="text-center p-6">
                   <Building2 size={40} className="mx-auto text-gray-300 mb-2" />
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">No logo uploaded</p>
                </div>
              )}
              
              <div className="absolute inset-0 bg-[#0f172a]/10 hover:bg-[#0f172a]/60 flex items-center justify-center transition-all cursor-pointer group">
                 <input 
                   type="file" 
                   className="absolute inset-0 opacity-0 cursor-pointer z-20" 
                   accept="image/*" 
                   onChange={handleFileChange}
                 />
                 <Upload className="text-white opacity-40 group-hover:opacity-100 transition-opacity" size={24} />
              </div>
            </div>

            <p className="text-[9px] text-gray-400 mt-4 text-center font-bold uppercase tracking-widest">
               SVG, PNG or WEBP (Max 2MB)
            </p>

            {logoFile && (
              <Button 
                variant="primary" 
                onClick={handleUpdateLogo} 
                disabled={loading}
                className="w-full mt-6"
              >
                {loading ? "Syncing..." : "Push New Logo"}
              </Button>
            )}
          </div>

          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex gap-4">
             <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 size={20} />
             </div>
             <div>
                <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Live Synchronization</p>
                <p className="text-xs text-emerald-600/80 mt-1">Logo changes reflect instantly on navbar and generated invoices.</p>
             </div>
          </div>
        </div>

        {/* DETAILS BOX */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-[#F2F2F2] shadow-sm space-y-8">
            <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-widest border-b border-[#F2F2F2] pb-4">Corporate registry</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                     <Building2 size={12} /> Company name
                  </label>
                  <input 
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    placeholder="e.g. Doller Coach"
                    className="w-full h-12 px-5 rounded-xl bg-[#f1f5f9] border border-transparent text-sm font-bold text-[#0f172a] focus:bg-white focus:ring-4 focus:ring-[#0f172a]/5 focus:border-[#0f172a]/30 transition-all outline-none" 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                     <FileText size={12} /> GSTIN Number
                  </label>
                  <input 
                    value={formData.gst}
                    onChange={(e) => setFormData({...formData, gst: e.target.value})}
                    placeholder="e.g. 09VKC236QJZE"
                    className="w-full h-12 px-5 rounded-xl bg-[#f1f5f9] border border-transparent text-sm font-bold text-[#0f172a] focus:bg-white focus:ring-4 focus:ring-[#0f172a]/5 focus:border-[#0f172a]/30 transition-all outline-none" 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                     <Phone size={12} /> Corporate Phone
                  </label>
                  <input 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+91 9690668290"
                    className="w-full h-12 px-5 rounded-xl bg-[#f1f5f9] border border-transparent text-sm font-bold text-[#0f172a] focus:bg-white focus:ring-4 focus:ring-[#0f172a]/5 focus:border-[#0f172a]/30 transition-all outline-none" 
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                     <Mail size={12} /> Corporate Email
                  </label>
                  <input 
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="brand@dollercoach.com"
                    className="w-full h-12 px-5 rounded-xl bg-[#f1f5f9] border border-transparent text-sm font-bold text-[#0f172a] focus:bg-white focus:ring-4 focus:ring-[#0f172a]/5 focus:border-[#0f172a]/30 transition-all outline-none" 
                  />
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <MapPin size={12} /> Registered Address
               </label>
               <textarea 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows={3}
                  className="w-full p-5 rounded-xl bg-[#f1f5f9] border border-transparent text-sm font-bold text-[#0f172a] focus:bg-white focus:ring-4 focus:ring-[#0f172a]/5 focus:border-[#0f172a]/30 transition-all outline-none resize-none" 
                  placeholder="Street, City, Zip, Country"
               />
            </div>

            <div className="pt-4 flex justify-end">
               <Button 
                 type="submit" 
                 variant="primary" 
                 disabled={loading}
                 className="px-8"
               >
                 <Save size={18} /> {loading ? "Saving Registry..." : "Save All Changes"}
               </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
