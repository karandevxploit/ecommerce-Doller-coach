import { useState, useEffect, useCallback } from "react";
import { useConfigStore } from "../../store/configStore";
import {
  Building2,
  Phone,
  Mail,
  FileText,
  MapPin,
  Save
} from "lucide-react";
import Button from "../../components/ui/Button";
import toast from "react-hot-toast";

export default function Settings() {
  const { config, fetchConfig, updateConfig } = useConfigStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    company_name: "",
    phone: "",
    email: "",
    gst: "",
    address: "",
  });

  // ✅ STABLE FETCH
  const loadConfig = useCallback(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ✅ SAFE SET FORM
  useEffect(() => {
    if (!config) return;

    setFormData({
      company_name: config.company_name || "",
      phone: config.phone || "",
      email: config.email || "",
      gst: config.gst || "",
      address: config.address || "",
    });
  }, [config]);

  // ✅ VALIDATION
  const validate = () => {
    if (!formData.company_name.trim()) {
      toast.error("Company name required");
      return false;
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error("Invalid email");
      return false;
    }

    if (formData.phone && formData.phone.length < 8) {
      toast.error("Invalid phone number");
      return false;
    }

    return true;
  };

  // ✅ SAFE SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    const payload = {
      company_name: formData.company_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      gst: formData.gst.trim(),
      address: formData.address.trim(),
    };

    try {
      await updateConfig(payload);
      toast.success("Settings saved successfully");
    } catch (err) {
      console.error("CONFIG UPDATE ERROR:", err?.response?.data || err?.message);
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-10">

      {/* HEADER */}
      <div className="border-b border-[#F2F2F2] pb-6">
        <h1 className="text-3xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">
          Brand identity settings
        </h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3">
          Manage global branding assets and corporate identifiers.
        </p>
      </div>

      <div className="max-w-3xl">
        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-2xl border border-[#F2F2F2] shadow-sm space-y-8"
        >
          <h3 className="text-sm font-black text-[#0f172a] uppercase tracking-widest border-b border-[#F2F2F2] pb-4">
            Corporate registry
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* COMPANY */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Building2 size={12} /> Company name
              </label>
              <input
                value={formData.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="e.g. Doller Coach"
                className="input-style"
              />
            </div>

            {/* GST */}
            <div className="space-y-2">
              <label className="label">
                <FileText size={12} /> GSTIN Number
              </label>
              <input
                value={formData.gst}
                onChange={(e) => updateField("gst", e.target.value)}
                placeholder="e.g. 09ABCDE1234F1Z5"
                className="input-style"
              />
            </div>

            {/* PHONE */}
            <div className="space-y-2">
              <label className="label">
                <Phone size={12} /> Phone
              </label>
              <input
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+91 9876543210"
                className="input-style"
              />
            </div>

            {/* EMAIL */}
            <div className="space-y-2">
              <label className="label">
                <Mail size={12} /> Email
              </label>
              <input
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="brand@email.com"
                className="input-style"
              />
            </div>
          </div>

          {/* ADDRESS */}
          <div className="space-y-2">
            <label className="label">
              <MapPin size={12} /> Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => updateField("address", e.target.value)}
              rows={3}
              className="textarea-style"
              placeholder="Street, City, Zip, Country"
            />
          </div>

          {/* SUBMIT */}
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              <Save size={16} />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}