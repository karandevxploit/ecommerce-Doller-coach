import { useState, useEffect, useCallback } from "react";
import { api } from "../../api/client";
import { mapProduct } from "../../api/dynamicMapper";
import {
  Plus, Search as SearchIcon, Image as ImageIcon,
  MoreVertical, Filter, Download, ArrowUpDown, ChevronLeft, ChevronRight
} from "lucide-react";
import toast from "react-hot-toast";
import ProductsForm from "../components/products/ProductsForm";

const formatPrice = (p) =>
  Number(p || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProducts = useCallback(async (page = 1, query = search) => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/products?page=${page}&limit=12&q=${query}`);
      const d = res?.data;
      const list = Array.isArray(d?.data) ? d.data : [];

      const mapped = list.map((item) => ({
        ...mapProduct(item),
        id: item?._id || item?.id,
        _id: item?._id
      }));

      setProducts(mapped);
      setMeta({
        page: d?.meta?.page || 1,
        totalPages: d?.meta?.totalPages || 1,
      });
      setCurrentPage(page);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchProducts(1, search), 400);
    return () => clearTimeout(t);
  }, [search, fetchProducts]);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this masterpiece?")) return;
    try {
      await api.delete(`/admin/products/${id}`);
      toast.success("Product removed");
      
      // 🔥 Optimistic UI Update: Remove from list immediately
      setProducts(prev => prev.filter(p => p.id !== id));
      
      // Sync with server to handle pagination / count updates
      fetchProducts(currentPage);
    } catch {
      toast.error("Delete failed");
    }
  };

  if (formOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 overflow-hidden">
        <ProductsForm 
          initialData={editingProduct} 
          onSuccess={() => {
            setFormOpen(false);
            fetchProducts(currentPage);
          }}
          onCancel={() => setFormOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Products</h1>
          <p className="text-slate-500 font-medium mt-1">Manage your inventory with precision</p>
        </div>
        <div className="flex gap-3">
          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={20} />
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:shadow-xl hover:shadow-slate-900/20 active:scale-95 transition-all"
          >
            <Plus size={20} />
            <span>New Product</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-xl shadow-slate-200/40 border border-slate-100">
        <div className="relative w-full md:w-96">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, SKUs, colors..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-slate-900 transition-all font-medium text-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-slate-900 transition-all">
            <Filter size={16} /> 
            <span>Filters</span>
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-slate-900 transition-all">
            <ArrowUpDown size={16} /> 
            <span>Sort</span>
          </button>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="aspect-[4/5] bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <ImageIcon size={32} className="text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No products found</h3>
          <p className="text-slate-500 mt-2">Try adjusting your filters or search terms</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 pb-12">
          {products.map((p) => {
            const mainImg = p.images?.[0] || p.image || "";
            return (
              <div 
                key={p.id} 
                className="group bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-slate-50">
                  <img
                    src={mainImg || "/placeholder.png"}
                    alt={p.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                    <button 
                      onClick={() => {
                        setEditingProduct(p);
                        setFormOpen(true);
                      }}
                      className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl text-slate-900 hover:bg-slate-900 hover:text-white transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="absolute bottom-4 inset-x-4 translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="flex gap-2">
                       <button 
                        onClick={() => {
                          setEditingProduct(p);
                          setFormOpen(true);
                        }}
                        className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl"
                      >
                        Edit Details
                      </button>
                      <button 
                         onClick={() => handleDelete(p.id)}
                         className="p-3 bg-rose-500 text-white rounded-xl shadow-xl hover:bg-rose-600 transition-all"
                      >
                        <Trash2Custom size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {typeof p.category === 'object' ? p.category?.main : p.category}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${p.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {p.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 truncate group-hover:text-slate-600 transition-colors">{p.title}</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-lg font-black text-slate-900">{formatPrice(p.price)}</span>
                    {p.originalPrice > p.price && (
                      <span className="text-xs font-bold text-slate-300 line-through">{formatPrice(p.originalPrice)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-8">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="p-4 bg-white border border-slate-200 rounded-2xl disabled:opacity-30 hover:border-slate-900 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            {[...Array(meta.totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-12 h-12 rounded-2xl text-sm font-bold transition-all ${
                  currentPage === i + 1 
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/20' 
                  : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-400'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button 
             disabled={currentPage === meta.totalPages}
             onClick={() => setCurrentPage(p => p + 1)}
             className="p-4 bg-white border border-slate-200 rounded-2xl disabled:opacity-30 hover:border-slate-900 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function Trash2Custom({ size }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}