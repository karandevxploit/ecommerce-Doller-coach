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
          res?.data ||
          res?.items ||
          (Array.isArray(res) ? res : []);

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
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <SearchIcon size={16} />
              <span>Search Results</span>
            </div>

            <h1 className="text-2xl font-semibold mt-1">
              {query
                ? `Results for "${query}"`
                : "Search products"}
            </h1>

            {query && (
              <p className="text-sm text-gray-500 mt-1">
                {products.length} products found
              </p>
            )}
          </div>

          <button
            onClick={() => navigate("/collection")}
            className="h-10 px-4 border rounded-lg text-sm flex items-center gap-2"
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