import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import ProductCard from "../components/ProductCard";
import toast from "react-hot-toast";
import {
  Search as SearchIcon,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function Search() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const query = (params.get("q") || "").trim();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(query);

  /* ---------------- DEBOUNCE SEARCH ---------------- */
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm !== query) {
        navigate(`/search?q=${encodeURIComponent(searchTerm)}`);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, query, navigate]);

  /* ---------------- FETCH ---------------- */
  useEffect(() => {
    let cancelled = false;

    const fetchResults = async () => {
      if (!query) {
        setProducts([]);
        return;
      }

      setLoading(true);

      try {
        const res = await api.get(
          `/products?q=${encodeURIComponent(query)}`
        );

        const raw =
          res?.data?.products || 
          res?.data?.data || 
          res?.data || 
          [];

        const mapped = Array.isArray(raw)
          ? raw.map(mapProduct)
          : [];

        if (!cancelled) setProducts(mapped);
      } catch {
        toast.error("Failed to load search results");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchResults();

    return () => {
      cancelled = true;
    };
  }, [query]);

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between gap-6 mb-8 border-b pb-6 items-center">
          <div className="w-full md:w-auto">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">
              <SearchIcon size={14} />
              <span>Search Database</span>
            </div>

            <h1 className="text-3xl font-black uppercase tracking-tighter">
              {query
                ? `Results for "${query}"`
                : "Search products"}
            </h1>
          </div>

          <div className="relative w-full md:w-96">
            <input
              type="text"
              placeholder="What are you looking for?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>

          <button
            onClick={() => navigate("/collection")}
            className="hidden md:flex h-12 px-6 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest items-center gap-2 hover:bg-black hover:text-white transition-all"
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
        {!loading && !products.length && query && (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">
              No products found for "{query}"
            </p>

            <button
              onClick={() => navigate("/collection")}
              className="px-6 py-3 bg-black text-white rounded-lg"
            >
              Browse Products
            </button>
          </div>
        )}

        {/* NO QUERY */}
        {!query && (
          <div className="text-center py-20 text-gray-500">
            Start typing to search products
          </div>
        )}

        {/* RESULTS */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}