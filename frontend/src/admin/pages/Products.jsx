import { useState, useEffect, useCallback, useMemo } from "react";
import { api, isCancelledRequest } from "../../api/client";
import { mapProduct } from "../../api/dynamicMapper";
import {
  Plus,
  Search as SearchIcon,
  Image as ImageIcon,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import ProductsForm from "../components/products/ProductsForm";
import { FALLBACK_IMAGE_URL, resolveImageUrl } from "../../utils/url";

const formatPrice = (price) =>
  Number(price || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

const getProductPayload = (responseData) => {
  const payload = responseData?.data || responseData || {};

  if (Array.isArray(payload)) {
    return {
      products: payload,
      currentPage: 1,
      totalPages: 1,
    };
  }

  if (Array.isArray(payload.products)) {
    return {
      products: payload.products,
      currentPage: payload.currentPage || payload.page || 1,
      totalPages: payload.pages || payload.totalPages || 1,
    };
  }

  if (Array.isArray(payload.items)) {
    return {
      products: payload.items,
      currentPage: payload.currentPage || payload.page || 1,
      totalPages: payload.pages || payload.totalPages || 1,
    };
  }

  return {
    products: [],
    currentPage: 1,
    totalPages: 1,
  };
};

const normalizeProduct = (item, index) => {
  const mapped = mapProduct(item || {});
  const id = String(item?._id || item?.id || mapped?.id || `product-${index}`);

  return {
    ...mapped,
    raw: item,
    id,
    _id: String(item?._id || mapped?._id || id),
    title: mapped?.title || item?.title || item?.name || "Untitled Product",
    images: Array.isArray(mapped?.images)
      ? mapped.images
      : Array.isArray(item?.images)
        ? item.images
        : [],
    image: mapped?.image || item?.image || "",
    price: Number(mapped?.price ?? item?.price ?? 0) || 0,
    originalPrice: Number(mapped?.originalPrice ?? item?.originalPrice ?? 0) || 0,
    stock: Number(mapped?.stock ?? item?.stock ?? 0) || 0,
    category: mapped?.category || item?.category || "",
    status: mapped?.status || item?.status || "active",
  };
};

const getCategoryGender = (category) =>
  String(category?.gender || category?.type || "").toLowerCase();

const isCancelError = (err) => {
  return (
    isCancelledRequest?.(err) ||
    err?.name === "CanceledError" ||
    err?.name === "AbortError" ||
    err?.code === "ERR_CANCELED"
  );
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [genderFilter, setGenderFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState([]);
  const [statsProducts, setStatsProducts] = useState([]);

  const buildParams = useCallback((page = 1, query = "", limit = 12) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (query.trim()) params.set("q", query.trim());
    if (genderFilter !== "all") params.set("gender", genderFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    return params.toString();
  }, [genderFilter, categoryFilter]);

  const fetchProducts = useCallback(async (page = 1, query = "", signal) => {
    try {
      setLoading(true);

      const res = await api.get(
        `/admin/products?${buildParams(page, query, 18)}`,
        { signal }
      );

      const payload = getProductPayload(res?.data);
      const mapped = payload.products.map(normalizeProduct);
      const uniqueMapped = Array.from(new Map(mapped.map((p) => [p.id, p])).values());

      setProducts(uniqueMapped);
      setMeta({
        page: payload.currentPage || page,
        totalPages: Math.max(Number(payload.totalPages || 1), 1),
      });
      setCurrentPage(payload.currentPage || page);
    } catch (err) {
      if (isCancelError(err)) return;

      console.error("PRODUCTS_FETCH_ERROR:", err?.response?.data || err?.message);
      toast.error(err?.response?.data?.message || "Failed to load products");
      setProducts([]);
      setMeta({ page: 1, totalPages: 1 });
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [buildParams]);

  const fetchFilterData = useCallback(async (signal) => {
    try {
      const [catRes, productRes] = await Promise.all([
        api.get("/admin/categories", { signal }),
        api.get("/admin/products?page=1&limit=100", { signal }),
      ]);

      const catPayload = catRes?.data?.data || catRes?.data || {};
      const categoryList = Array.isArray(catPayload)
        ? catPayload
        : catPayload.categories || catPayload.items || [];
      setCategories(categoryList);

      const payload = getProductPayload(productRes?.data);
      setStatsProducts(payload.products.map(normalizeProduct));
    } catch (err) {
      if (isCancelError(err)) return;
      console.error("PRODUCT_FILTER_DATA_ERROR:", err?.response?.data || err?.message);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchProducts(1, search, controller.signal);
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, fetchProducts, genderFilter, categoryFilter]);

  useEffect(() => {
    const controller = new AbortController();

    fetchProducts(currentPage, search, controller.signal);

    return () => controller.abort();
  }, [currentPage, fetchProducts, genderFilter, categoryFilter]);

  useEffect(() => {
    const controller = new AbortController();
    fetchFilterData(controller.signal);
    return () => controller.abort();
  }, [fetchFilterData]);

  const filterStats = useMemo(() => {
    const uniqueProducts = Array.from(
      new Map(statsProducts.map((product) => [product.id || product._id, product])).values()
    );
    const genderCounts = { all: uniqueProducts.length, men: 0, women: 0 };
    const categoryCounts = new Map();

    uniqueProducts.forEach((product) => {
      const raw = product.raw || product;
      const gender = String(raw.gender || product.category?.gender || "").toLowerCase();
      if (gender === "men") genderCounts.men += 1;
      if (gender === "women") genderCounts.women += 1;

      const categoryId = String(raw.category?._id || raw.category?.id || product.category?._id || product.category?.id || raw.category || "");
      if (categoryId) categoryCounts.set(categoryId, (categoryCounts.get(categoryId) || 0) + 1);
    });

    return { genderCounts, categoryCounts };
  }, [statsProducts]);

  const visibleCategories = useMemo(() => {
    const selectedGender = String(genderFilter || "all").toLowerCase();
    if (selectedGender === "all") return categories;

    return categories.filter((category) => {
      const categoryGender = getCategoryGender(category);
      return !categoryGender || categoryGender === selectedGender;
    });
  }, [categories, genderFilter]);

  useEffect(() => {
    if (categoryFilter === "all") return;
    const selectedCategory = categories.find(
      (category) => String(category._id || category.id || "") === categoryFilter
    );
    const selectedCategoryGender = getCategoryGender(selectedCategory);

    if (
      genderFilter !== "all" &&
      selectedCategoryGender &&
      selectedCategoryGender !== genderFilter
    ) {
      setCategoryFilter("all");
      setCurrentPage(1);
    }
  }, [categories, categoryFilter, genderFilter]);

  const handleToggleStatus = async (id) => {
    if (!id || statusUpdatingId) return;

    const previousProducts = products;

    try {
      setStatusUpdatingId(id);

      const res = await api.patch(`/admin/products/${id}/status`);
      const nextStatus = res?.data?.data?.status || res?.data?.status;

      if (nextStatus) {
        setProducts((prev) =>
          prev.map((product) =>
            product.id === id || product._id === id
              ? { ...product, status: nextStatus }
              : product
          )
        );
        toast.success(`Status updated to ${nextStatus}`);
      } else {
        await fetchProducts(currentPage, search);
        toast.success("Status updated");
      }
    } catch (err) {
      console.error("PRODUCT_STATUS_ERROR:", err?.response?.data || err?.message);
      setProducts(previousProducts);
      toast.error(err?.response?.data?.message || "Status update failed");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!id || deletingId) return;
    if (!window.confirm("Delete this masterpiece?")) return;

    const previousProducts = products;

    try {
      setDeletingId(id);
      setProducts((prev) => prev.filter((p) => p.id !== id && p._id !== id));

      const res = await api.delete(`/admin/products/${id}`);

      if (res.status === 200 || res.data?.success) {
        toast.success("Product removed");
        await fetchProducts(currentPage, search);
      }
    } catch (err) {
      console.error("PRODUCT_DELETE_ERROR:", err?.response?.data || err?.message);
      setProducts(previousProducts);
      toast.error(err?.response?.data?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFormSuccess = async () => {
    setFormOpen(false);
    setEditingProduct(null);
    await fetchProducts(currentPage, search);
  };

  if (formOpen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 overflow-hidden">
        <ProductsForm
          initialData={editingProduct}
          onSuccess={handleFormSuccess}
          onCancel={() => {
            setFormOpen(false);
            setEditingProduct(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="admin-shell animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="admin-heading">
            Products
          </h1>
          <p className="admin-muted mt-1">
            Inventory Management
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className="icon-button"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setFormOpen(true);
            }}
            className="btn-luxury h-10 px-5"
          >
            <Plus size={16} />
            <span>New Product</span>
          </button>
        </div>
      </div>

      <div className="admin-card flex flex-col md:flex-row gap-3 items-center justify-between p-3">
        <div className="relative w-full md:w-80">
          <SearchIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            value={search}
            onChange={(e) => {
              setCurrentPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Quick search..."
            className="control-input w-full pl-10 h-10 text-xs"
          />
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className="btn-luxury-outline h-10 px-4 flex-1 md:flex-none"
          >
            <Filter size={14} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {filtersOpen && (
        <div className="admin-card p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["all", `All (${filterStats.genderCounts.all})`],
              ["men", `Men (${filterStats.genderCounts.men})`],
              ["women", `Women (${filterStats.genderCounts.women})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setGenderFilter(value);
                  if (value === "all") {
                    setCategoryFilter("all");
                  } else {
                    const selectedCategory = categories.find(
                      (category) => String(category._id || category.id || "") === categoryFilter
                    );
                    const selectedCategoryGender = getCategoryGender(selectedCategory);
                    if (selectedCategoryGender && selectedCategoryGender !== value) {
                      setCategoryFilter("all");
                    }
                  }
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                  genderFilter === value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                categoryFilter === "all"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-900"
              }`}
            >
              All Categories
            </button>

            {visibleCategories.map((category) => {
              const id = String(category._id || category.id || "");
              const count = filterStats.categoryCounts.get(id) || 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(id);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                    categoryFilter === id
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-900"
                  }`}
                >
                  {category.name || "Category"} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="aspect-[3/4] bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <ImageIcon size={32} className="text-slate-300 mb-4" />
          <h3 className="text-sm font-black text-slate-900 uppercase">
            No products found
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1">
            Try a different search
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 pb-12">
          {products.map((product) => {
            const mainImg = product.images?.[0] || product.image || "";
            const imageSrc = resolveImageUrl(mainImg);
            const categoryLabel =
              typeof product.category === "object"
                ? product.category?.main || product.category?.name || ""
                : product.category || "";

            return (
              <div
                key={product.id}
                className="group admin-card hover:shadow-md transition-all duration-300 overflow-hidden"
              >
                <div className="relative h-[125px] overflow-hidden bg-slate-50">
                  <img
                    src={imageSrc}
                    alt={product.title || "Product"}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE_URL;
                    }}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(product.raw || product);
                        setFormOpen(true);
                      }}
                      className="icon-button !h-8 !w-8 shadow-lg"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="absolute inset-x-2 bottom-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={statusUpdatingId === product.id}
                        onClick={() => handleToggleStatus(product.id)}
                        className={`p-2 flex-1 ${product.status === "active" ? "bg-emerald-500" : "bg-slate-500"
                          } text-white rounded-lg shadow-lg hover:opacity-90 transition-all disabled:opacity-60`}
                      >
                        <Zap size={14} className="mx-auto" />
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === product.id}
                        onClick={() => handleDelete(product.id)}
                        className="p-2 flex-1 bg-rose-500 text-white rounded-lg shadow-lg hover:bg-rose-600 transition-all disabled:opacity-60"
                      >
                        <Trash2 size={14} className="mx-auto" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-2.5">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[70%]">
                      {categoryLabel}
                    </span>

                    <span
                      className={`text-[8px] font-black uppercase tracking-tighter ${product.status === "active" ? "text-emerald-500" : "text-slate-400"
                        }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <h3 className="text-[11px] font-black text-slate-900 truncate mb-1">
                    {product.title}
                  </h3>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-black text-slate-900">
                      {formatPrice(product.price)}
                    </span>

                    {Number(product.originalPrice) > Number(product.price) && (
                      <span className="text-[10px] font-bold text-slate-300 line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>

                  <div
                    className={`mt-1 text-[8px] font-black uppercase tracking-widest ${
                      product.stock <= 0
                        ? "text-rose-600"
                        : product.stock <= 3
                          ? "text-amber-600"
                          : "text-emerald-600"
                    }`}
                  >
                    {product.stock <= 0
                      ? "Out of stock"
                      : product.stock <= 3
                        ? `Low stock: ${product.stock}`
                        : `In stock: ${product.stock}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-8">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
            className="icon-button !h-11 !w-11 disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-2">
            {[...Array(meta.totalPages)].map((_, index) => (
              <button
                type="button"
                key={index}
                onClick={() => setCurrentPage(index + 1)}
                className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${currentPage === index + 1
                    ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20"
                    : "bg-white border border-slate-200 text-slate-400 hover:border-slate-400"
                  }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={currentPage === meta.totalPages}
            onClick={() => setCurrentPage((page) => Math.min(page + 1, meta.totalPages))}
            className="icon-button !h-11 !w-11 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
