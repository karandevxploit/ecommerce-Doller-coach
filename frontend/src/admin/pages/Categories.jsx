import { useState, useEffect, useCallback, useRef } from "react";
import { api, isCancelledRequest } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import { Plus, Trash2, Edit2, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

const initialFormData = {
  name: "",
  gender: "men",
  type: "top",
  sizes: "",
  description: "",
};

const getCategoryList = (responseData) => {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.categories)) return responseData.categories;
  return [];
};

const normalizeCategory = (cat) => ({
  ...cat,
  _id: cat?._id || cat?.id || "",
  name: cat?.name || "",
  gender: cat?.gender || "men",
  type: cat?.type || "other",
  sizes: Array.isArray(cat?.sizes) ? cat.sizes : [],
  description: cat?.description || "",
});

const parseSizes = (sizes) => {
  return String(sizes || "")
    .split(",")
    .map((size) => size.trim())
    .filter(Boolean);
};

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const deleteLocksRef = useRef(new Set());

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.get(ENDPOINTS.CATEGORIES.BASE);
      const list = getCategoryList(res?.data).map(normalizeCategory);

      setCategories(list);
    } catch (err) {
      if (isCancelledRequest(err)) return;

      console.error("CATEGORIES_FETCH_ERROR:", err);
      setCategories([]);
      setError("Failed to load categories catalog");
      toast.error("Failed to sync categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!mounted) return;
      await fetchCategories();
    };

    load();

    return () => {
      mounted = false;
    };
  }, [fetchCategories]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (saving) return;

    const name = formData.name.trim();
    const sizes = parseSizes(formData.sizes);

    if (!name) {
      toast.error("Category name is required");
      return;
    }

    if (!sizes.length) {
      toast.error("Add at least one size");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...formData,
        name,
        sizes,
        description: formData.description?.trim() || "",
      };

      if (editingId) {
        await api.put(`${ENDPOINTS.CATEGORIES.BASE}/${editingId}`, payload);
        toast.success("Category updated");
      } else {
        await api.post(ENDPOINTS.CATEGORIES.BASE, payload);
        toast.success("Category created");
      }

      resetForm();
      setIsFormOpen(false);
      await fetchCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id || deletingId || deleteLocksRef.current.has(id)) return;
    if (!window.confirm("Delete this category? Products using it might break.")) return;

    try {
      deleteLocksRef.current.add(id);
      setDeletingId(id);
      await api.delete(`${ENDPOINTS.CATEGORIES.BASE}/${id}`);
      setCategories((prev) => prev.filter((cat) => cat._id !== id));
      toast.success("Category deleted");
      await fetchCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      deleteLocksRef.current.delete(id);
      setDeletingId(null);
    }
  };

  const startEdit = (cat) => {
    const safeCat = normalizeCategory(cat);

    setFormData({
      name: safeCat.name,
      gender: safeCat.gender,
      type: safeCat.type,
      sizes: safeCat.sizes.join(", "),
      description: safeCat.description,
    });

    setEditingId(safeCat._id);
    setIsFormOpen(true);
  };

  return (
    <div className="admin-shell animate-in fade-in duration-500">
      <div className="admin-card p-4 md:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="admin-heading">Categories</h1>
          <p className="page-subtitle mt-1">
            Total categories: <span className="font-black text-slate-900">{categories.length}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:shadow-xl transition-all"
        >
          <Plus size={20} />
          <span>New Category</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="admin-card p-4 md:p-5 space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900">{editingId ? "Edit" : "New"} Category</h3>
            <button type="button" onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-900">
              <XCircle size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="control-input w-full px-4 py-3 font-medium"
                placeholder="e.g. T-Shirts"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="control-input w-full px-4 py-3 font-medium"
              >
                <option value="men">Men</option>
                <option value="women">Women</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="control-input w-full px-4 py-3 font-medium"
              >
                <option value="top">Topwear</option>
                <option value="bottom">Bottomwear</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sizes (Comma separated)</label>
              <input
                value={formData.sizes}
                onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                className="control-input w-full px-4 py-3 font-medium"
                placeholder="e.g. S, M, L, XL"
                required
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-60"
              >
                {saving ? "Saving..." : `${editingId ? "Update" : "Save"} Category`}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {loading ? (
          [1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />)
        ) : error ? (
          <div className="col-span-full py-20 text-center bg-rose-50 rounded-[2.5rem] border border-rose-100">
            <XCircle size={40} className="mx-auto text-rose-500 mb-4" />
            <p className="text-rose-600 font-bold uppercase tracking-widest text-xs">{error}</p>
            <button type="button" onClick={fetchCategories} className="mt-4 text-[10px] font-black uppercase tracking-widest underline decoration-rose-200 hover:text-rose-900 transition-all">
              Try Re-syncing
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
            <CheckCircle size={40} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No categories found in system</p>
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat._id || cat.name} className="group admin-card p-4 transition-all relative">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">
                    {cat.gender} • {cat.type}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-2">{cat.name}</h3>
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button type="button" onClick={() => startEdit(cat)} className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all">
                    <Edit2 size={13} />
                  </button>
                  <button type="button" disabled={deletingId === cat._id} onClick={() => handleDelete(cat._id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all disabled:opacity-60">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {cat.sizes.map((size) => (
                  <span key={`${cat._id}-${size}`} className="px-2 py-1 bg-slate-50 text-[9px] font-bold text-slate-400 rounded-md">
                    {size}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
