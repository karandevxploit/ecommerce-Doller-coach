import { useState, useMemo } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  Plus,
} from "lucide-react";
import { api } from "../api/client";
import { ENDPOINTS } from "../api/endpoints";
import { mapProduct } from "../api/dynamicMapper";
import FilterSidebar from "../components/FilterSidebar";
import ProductGrid from "../components/ProductGrid";
import { motion, AnimatePresence } from "framer-motion";

const SORT_OPTIONS = [
  { label: "Trending", value: "trending" },
  { label: "Newest", value: "newest" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
];

export default function Collection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  const { category: paramCategory } = useParams();

  /* ---------------- FILTERS ---------------- */
  const filters = useMemo(() => {
    const category =
      paramCategory || searchParams.get("category") || "";

    return {
      category: category.toLowerCase(),
      color: searchParams.get("color") || "",
      size: searchParams.get("size") || "",
      q: searchParams.get("q") || "",
      sort: searchParams.get("sort") || "trending",
    };
  }, [searchParams, paramCategory]);

  /* ---------------- FILTER META ---------------- */
  const { data: filterMeta } = useQuery({
    queryKey: ["filters"],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.PRODUCTS.FILTERS);
      return res?.data || res || {};
    },
    staleTime: 1000 * 60 * 60,
  });

  /* ---------------- PRODUCTS ---------------- */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["products", filters],
    queryFn: async ({ pageParam = 1 }) => {
      const query = new URLSearchParams(searchParams);
      query.set("page", pageParam);
      query.set("limit", "24");

      if (filters.category) {
        query.set("category", filters.category);
      }

      const res = await api.get(
        `${ENDPOINTS.PRODUCTS.LIST}?${query.toString()}`
      );

      const raw = res?.data || res || {};

      return {
        products: (raw.data || []).map(mapProduct),
        total: raw.total || 0,
        nextPage: pageParam + 1,
        hasMore: pageParam < (raw.pages || 1),
      };
    },
    getNextPageParam: (last) =>
      last.hasMore ? last.nextPage : undefined,
  });

  const products = useMemo(
    () => data?.pages.flatMap((p) => p.products) || [],
    [data]
  );

  const totalResults = data?.pages?.[0]?.total || 0;

  /* ---------------- FILTER UPDATE ---------------- */
  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);

    if (!value) params.delete(key);
    else params.set(key, value);

    params.delete("page");
    setSearchParams(params);
  };

  const clearFilters = () => setSearchParams({});

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-white min-h-screen">
      {/* MOBILE FILTER BUTTON */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[85%] max-w-sm">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="w-full bg-black text-white py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold">
            {filters.category || "All Products"}
          </h1>

          {/* SORT */}
          <div className="relative group">
            <button className="flex items-center gap-2 border px-4 py-2 rounded-lg text-sm">
              {
                SORT_OPTIONS.find(
                  (o) => o.value === filters.sort
                )?.label
              }
              <ChevronDown size={14} />
            </button>

            <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow hidden group-hover:block z-50">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => updateFilter("sort", o.value)}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* SIDEBAR */}
          <aside className="hidden lg:block w-64">
            <FilterSidebar
              filters={filterMeta}
              activeFilters={filters}
              onUpdate={updateFilter}
              onClear={clearFilters}
            />
          </aside>

          {/* MAIN */}
          <main className="flex-1">
            {/* TOP BAR */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">
                {products.length} of {totalResults} products
              </p>

              <div className="flex gap-2">
                <button onClick={() => setViewMode("grid")}>
                  <LayoutGrid size={20} />
                </button>
                <button onClick={() => setViewMode("list")}>
                  <LayoutList size={20} />
                </button>
              </div>
            </div>

            {/* PRODUCTS */}
            <ProductGrid
              products={products}
              viewMode={viewMode}
              loading={isLoading}
              error={isError}
            />

            {/* EMPTY STATE */}
            {!isLoading && !products.length && (
              <div className="text-center py-20">
                <p className="text-gray-500 mb-4">
                  No products found
                </p>
                <button
                  onClick={clearFilters}
                  className="text-black underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* LOAD MORE */}
            {hasNextPage && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={fetchNextPage}
                  disabled={isFetchingNextPage}
                  className="px-6 py-3 border rounded-lg flex items-center gap-2"
                >
                  {isFetchingNextPage
                    ? "Loading..."
                    : "Load More"}
                  <Plus size={16} />
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MOBILE FILTER DRAWER */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setMobileFiltersOpen(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 w-full bg-white p-6 z-50 rounded-t-xl max-h-[80vh] overflow-auto"
            >
              <FilterSidebar
                filters={filterMeta}
                activeFilters={filters}
                onUpdate={updateFilter}
                onClear={clearFilters}
              />

              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full mt-4 bg-black text-white py-3 rounded-lg"
              >
                Apply Filters
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}