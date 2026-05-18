import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import { ENDPOINTS } from "../api/endpoints";
import ProductCard from "../components/ProductCard";
import toast from "react-hot-toast";
import {
  Search as SearchIcon,
  ArrowRight,
  Loader2,
} from "lucide-react";

const getProductList = (response) => {
  const body = response?.data ?? response;
  const data = body?.data ?? body;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.products)) return data.data.products;

  return [];
};

const isCanceled = (error) => {
  return (
    error?.name === "CanceledError" ||
    error?.name === "AbortError" ||
    error?.code === "ERR_CANCELED" ||
    error?.message?.toLowerCase?.().includes("canceled")
  );
};

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const query = (params.get("q") || "").trim();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(query);

  useEffect(() => {
    setSearchTerm(query);
  }, [query]);

  /* ---------------- DEBOUNCE SEARCH ---------------- */
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const next = searchTerm.trim();

      if (next === query) return;

      if (!next) {
        navigate("/search", { replace: true });
        return;
      }

      navigate(`/search?q=${encodeURIComponent(next)}`, { replace: true });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, query, navigate]);

  /* ---------------- FETCH ---------------- */
  useEffect(() => {
    const controller = new AbortController();

    const fetchResults = async () => {
      if (!query) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const endpoint = ENDPOINTS?.PRODUCTS?.LIST || "/products";

        const res = await api.get(endpoint, {
          params: { q: query },
          signal: controller.signal,
        });

        const mapped = getProductList(res).map(mapProduct).filter(Boolean);

        setProducts(mapped);
      } catch (err) {
        if (!isCanceled(err)) {
          setProducts([]);
          toast.error(
            err?.response?.data?.message || "Failed to load search results"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchResults();

    return () => {
      controller.abort();
    };
  }, [query]);

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="page-shell">
        {/* HEADER */}
        <div className="surface p-4 md:p-5 flex flex-col md:flex-row justify-between gap-4 mb-5 items-stretch md:items-center">
          <div className="w-full md:w-auto">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">
              <SearchIcon size={14} />
              <span>Search Database</span>
            </div>

            <h1 className="page-title">
              {query ? `Results for "${query}"` : "Search products"}
            </h1>
          </div>

          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="What are you looking for?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="control-input w-full pl-11"
            />
            <SearchIcon
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
          </div>

          <button
            type="button"
            onClick={() => navigate("/collection")}
              className="hidden md:flex btn-luxury-outline h-11 px-5"
          >
            Browse All <ArrowRight size={14} />
          </button>
        </div>

        {/* LOADING */}
        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin" />
          </div>
        )}

        {/* EMPTY */}
        {!loading && products.length === 0 && query && (
          <div className="empty-state">
            <p className="text-slate-500 font-semibold mb-4">
              No products found for "{query}"
            </p>

            <button
              type="button"
              onClick={() => navigate("/collection")}
              className="btn-luxury"
            >
              Browse Products
            </button>
          </div>
        )}

        {/* NO QUERY */}
        {!loading && !query && (
          <div className="empty-state text-slate-500 font-semibold">
            Start typing to search products
          </div>
        )}

        {/* RESULTS */}
        {!loading && products.length > 0 && (
          <div className="product-grid-compact">
            {products.map((product, index) => (
              <ProductCard
                key={product.id || product._id || `search-product-${index}`}
                product={product}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
