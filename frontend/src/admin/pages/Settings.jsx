import { useState, useEffect, useCallback } from "react";
import { useConfigStore } from "../../store/configStore";
import {
  Building2,
  Phone,
  Mail,
  FileText,
  MapPin,
  Save,
} from "lucide-react";
import Button from "../../components/ui/Button";
import toast from "react-hot-toast";

const initialFormData = {
  company_name: "",
  phone: "",
  email: "",
  gst: "",
  address: "",
};

const normalizeConfig = (config) => ({
  company_name: config?.company_name || "",
  phone: config?.phone || "",
  email: config?.email || "",
  gst: config?.gst || "",
  address: config?.address || "",
});

const isValidEmail = (email) => {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const cleanPhone = (phone) => {
  return String(phone || "").replace(/[^\d+]/g, "");
};

const fieldClass =
  "w-full h-12 rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5";

const textareaClass =
  "w-full min-h-32 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all resize-none placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5";

const FieldLabel = ({ icon: Icon, children }) => (
  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
    <Icon size={13} className="text-slate-500" />
    {children}
  </label>
);

export default function Settings() {
  const { config, fetchConfig, updateConfig } = useConfigStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const loadConfig = useCallback(async () => {
    try {
      await fetchConfig();
    } catch (err) {
      console.error("CONFIG_FETCH_ERROR:", err?.response?.data || err?.message);
      toast.error("Failed to load settings");
    }
  }, [fetchConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    setFormData(normalizeConfig(config));
  }, [config]);

  const validate = () => {
    const companyName = formData.company_name.trim();
    const email = formData.email.trim();
    const phone = cleanPhone(formData.phone);

    if (!companyName) {
      toast.error("Company name required");
      return false;
    }

    if (!isValidEmail(email)) {
      toast.error("Invalid email");
      return false;
    }

    if (phone && phone.replace(/\D/g, "").length < 8) {
      toast.error("Invalid phone number");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading || !validate()) return;

    const payload = {
      company_name: formData.company_name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim().toLowerCase(),
      gst: formData.gst.trim().toUpperCase(),
      address: formData.address.trim(),
    };

    try {
      setLoading(true);
      await updateConfig(payload);
      toast.success("Settings saved successfully");
    } catch (err) {
      console.error("CONFIG_UPDATE_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-[calc(100vh-84px)] bg-slate-50/60 px-6 py-8 lg:px-10">
      <div className="max-w-5xl space-y-8">
        <div className="border-b border-slate-200 pb-7">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.28em]">
            Administration
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-black text-slate-950 tracking-tighter uppercase leading-none">
            Brand Identity
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
            Manage the company details used across invoices, storefront branding, and customer communication.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-950 uppercase tracking-widest">
                Corporate Registry
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Keep these fields accurate for legal and support surfaces.
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              loading={loading}
              className="h-11 rounded-xl px-5 font-black uppercase tracking-wider"
            >
              <Save size={16} />
              Save Changes
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel icon={Building2}>Company name</FieldLabel>
              <input
                value={formData.company_name}
                onChange={(e) => updateField("company_name", e.target.value)}
                placeholder="e.g. Doller Coach"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel icon={FileText}>GSTIN Number</FieldLabel>
              <input
                value={formData.gst}
                onChange={(e) => updateField("gst", e.target.value)}
                placeholder="e.g. 09ABCDE1234F1Z5"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel icon={Phone}>Phone</FieldLabel>
              <input
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="+91 9876543210"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel icon={Mail}>Email</FieldLabel>
              <input
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="brand@email.com"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <FieldLabel icon={MapPin}>Address</FieldLabel>
              <textarea
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
                rows={4}
                className={textareaClass}
                placeholder="Street, City, Zip, Country"
              />
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-6 md:col-span-2">
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                className="h-12 min-w-40 rounded-xl font-black uppercase tracking-wider"
              >
                <Save size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
