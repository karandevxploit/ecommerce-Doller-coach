import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  Plus,
  X,
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
  { label: "Popular", value: "popular" },
];

const MULTI_FILTERS = ["category", "colors", "sizes"];
const SPECIAL_COLLECTIONS = {
  "new-arrivals": {
    title: "New Arrivals",
    endpoint: "/products/new-arrivals",
    sort: "newest",
  },
  "best-sellers": {
    title: "Best Sellers",
    endpoint: "/products/best-sellers",
    sort: "popular",
  },
  "hot-sale": {
    title: "Hot Sell",
    endpoint: "/products/hot-sale",
    sort: "price-asc",
  },
  sale: {
    title: "Hot Sell",
    endpoint: "/products/hot-sale",
    sort: "price-asc",
  },
};

const getResponseBody = (response) => response?.data ?? response;

const getProductList = (response) => {
  const body = getResponseBody(response);
  const data = body?.data ?? body;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.products)) return data.data.products;

  return [];
};

const getPagination = (response, fallbackLength = 0) => {
  const body = getResponseBody(response);
  const data = body?.data ?? body;

  const total = Number(
    data?.total ??
    data?.totalProducts ??
    data?.count ??
    body?.total ??
    fallbackLength
  );

  const totalPages = Number(
    data?.totalPages ??
    body?.totalPages ??
    Math.max(1, Math.ceil(total / 20))
  );

  return {
    total: Number.isFinite(total) ? total : fallbackLength,
    totalPages: Number.isFinite(totalPages) ? totalPages : 1,
  };
};

const splitCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toggleCsvValue = (currentValue, nextValue) => {
  const value = String(nextValue || "").trim();
  if (!value) return "";

  const list = splitCsv(currentValue);

  if (list.includes(value)) {
    return list.filter((item) => item !== value).join(",");
  }

  return [...list, value].join(",");
};

export default function Collection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");

  const { gender: paramGender } = useParams();
  const collectionKey = String(paramGender || "").toLowerCase();
  const specialCollection = SPECIAL_COLLECTIONS[collectionKey] || null;

  /* ---------------- FILTERS ---------------- */
  const filters = useMemo(() => {
    return {
      category: searchParams.get("category") || "",
      gender: specialCollection
        ? ""
        : searchParams.get("gender") || paramGender || "men",
      colors: searchParams.get("colors") || "",
      sizes: searchParams.get("sizes") || "",
      minPrice: searchParams.get("minPrice") || "",
      maxPrice: searchParams.get("maxPrice") || "",
      rating: searchParams.get("rating") || "",
      availability: searchParams.get("availability") || "",
      q: searchParams.get("q") || "",
      sort: searchParams.get("sort") || specialCollection?.sort || "trending",
    };
  }, [searchParams, paramGender, specialCollection]);

  useEffect(() => {
    setSearchInput(filters.q || "");
  }, [filters.q]);

  const setFilterValue = useCallback(
    (key, value) => {
      const params = new URLSearchParams(searchParams);
      const nextValue = String(value || "").trim();

      if (!nextValue || nextValue === "all" || nextValue === "none") {
        params.delete(key);
      } else {
        params.set(key, nextValue);
      }

      params.delete("page");
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const updateFilter = useCallback(
    (key, value) => {
      if (MULTI_FILTERS.includes(key)) {
        const params = new URLSearchParams(searchParams);
        const nextValue = String(value || "").trim();

        if (!nextValue) {
          params.delete(key);
        } else if (nextValue.includes(",")) {
          params.set(key, nextValue);
        } else {
          const toggled = toggleCsvValue(params.get(key), nextValue);
          if (toggled) params.set(key, toggled);
          else params.delete(key);
        }

        params.delete("page");
        setSearchParams(params);
        return;
      }

      setFilterValue(key, value);
    },
    [searchParams, setSearchParams, setFilterValue]
  );

  const removeFilterValue = useCallback(
    (key, value) => {
      if (MULTI_FILTERS.includes(key)) {
        const params = new URLSearchParams(searchParams);
        const next = splitCsv(params.get(key))
          .filter((item) => item !== String(value))
          .join(",");

        if (next) params.set(key, next);
        else params.delete(key);

        params.delete("page");
        setSearchParams(params);
        return;
      }

      setFilterValue(key, "");
    },
    [searchParams, setSearchParams, setFilterValue]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== (filters.q || "")) {
        setFilterValue("q", searchInput.trim());
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters.q, setFilterValue]);

  /* ---------------- FILTER META ---------------- */
  const { data: filterMeta = {} } = useQuery({
    queryKey: ["filters", filters.gender, filters.category, collectionKey],
    queryFn: async () => {
      const res = await api.get(ENDPOINTS.PRODUCTS.FILTERS, {
        params: {
          gender: filters.gender || undefined,
          categoryId: filters.category || undefined,
        },
      });

      const body = getResponseBody(res);
      return body?.data || body || {};
    },
    staleTime: 1000 * 60 * 5,
  });

  /* ---------------- PRODUCTS ---------------- */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["products", filters, collectionKey],
    queryFn: async ({ pageParam = 1 }) => {
      const params = {
        page: pageParam,
        limit: 20,
      };

      if (
        filters.category &&
        filters.category !== "all" &&
        filters.category !== "none"
      ) {
        params.category = filters.category;
      }

      if (
        filters.gender &&
        filters.gender !== "collection" &&
        filters.gender !== "all"
      ) {
        params.gender = filters.gender;
      }

      if (filters.colors) params.colors = filters.colors;
      if (filters.sizes) params.sizes = filters.sizes;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
      if (filters.rating) params.rating = filters.rating;
      if (filters.availability) params.availability = filters.availability;
      if (filters.sort) params.sort = filters.sort;
      if (filters.q) params.q = filters.q;

      const endpoint = specialCollection?.endpoint || ENDPOINTS.PRODUCTS.LIST || "/products";
      const res = await api.get(endpoint, {
        params,
      });

      const rawProducts = getProductList(res);
      const pagination = getPagination(res, rawProducts.length);

      return {
        products: rawProducts.map(mapProduct).filter(Boolean),
        total: pagination.total,
        nextPage: pageParam + 1,
        hasMore: pageParam < pagination.totalPages,
      };
    },
    getNextPageParam: (lastPage) =>
      lastPage?.hasMore ? lastPage.nextPage : undefined,
    staleTime: 1000 * 60,
  });

  const products = useMemo(() => {
    const list = data?.pages?.flatMap((page) => page?.products || []) || [];
    return Array.from(
      new Map(
        list.map((product) => [
          String(product?._id || product?.id || product?.slug || product?.name || product?.title),
          product,
        ])
      ).values()
    );
  }, [data]);

  const totalResults = data?.pages?.[0]?.total || products.length;

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => value && !["gender", "q", "sort"].includes(key)
  );

  const clearFilters = () => {
    const params = new URLSearchParams();

    if (paramGender) {
      params.set("gender", paramGender);
    }

    setSearchInput("");
    setSearchParams(params);
  };

  const selectedSort =
    SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ||
    "Trending";

  /* ---------------- UI ---------------- */
  return (
    <div className="bg-slate-50 min-h-screen">
      {/* MOBILE FILTER BUTTON */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[85%] max-w-sm">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="w-full bg-black text-white py-3 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest shadow-xl"
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      <div className="page-shell">
        {/* HEADER */}
        <div className="surface p-4 md:p-5 mb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="page-subtitle uppercase tracking-widest font-black mb-1">
              Browse collection
            </p>
            <h1 className="page-title capitalize">
              {(specialCollection?.title || filters.gender || "All")} Collection
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:min-w-[460px]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products..."
              className="control-input w-full sm:flex-1"
            />

            {/* SORT */}
            <div className="relative group">
              <button
                type="button"
                className="h-11 flex items-center justify-between gap-2 border border-slate-200 bg-white px-4 rounded-lg text-xs font-black uppercase tracking-wider min-w-40"
              >
                {selectedSort}
                <ChevronDown size={14} />
              </button>

              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-lg shadow-xl hidden group-hover:block z-50 overflow-hidden">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateFilter("sort", option.value)}
                    className="block w-full text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wide hover:bg-slate-100"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-5">
          {/* SIDEBAR */}
          <aside className="hidden lg:block w-64 shrink-0">
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
            <div className="surface p-3 flex justify-between items-center mb-4 gap-3">
              <p className="text-xs text-slate-500 font-bold shrink-0">
                {products.length} of {totalResults} products
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (!value || ["gender", "q", "sort"].includes(key)) {
                    return null;
                  }

                  return splitCsv(value).map((item) => (
                    <button
                      key={`${key}-${item}`}
                      type="button"
                      onClick={() => removeFilterValue(key, item)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-900 rounded-full text-[10px] font-black uppercase hover:bg-black hover:text-white transition-all"
                    >
                      <span>{item}</span>
                      <X size={10} />
                    </button>
                  ));
                })}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[10px] font-black uppercase text-slate-900 underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                  className={`icon-button ${viewMode === "grid" ? "!bg-slate-950 !text-white !border-slate-950" : ""}`}
                >
                  <LayoutGrid size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                  className={`icon-button ${viewMode === "list" ? "!bg-slate-950 !text-white !border-slate-950" : ""}`}
                >
                  <LayoutList size={20} />
                </button>
              </div>
            </div>

            {/* PRODUCTS */}
            {isLoading || isError || products.length > 0 ? (
              <ProductGrid
                products={products}
                viewMode={viewMode}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
              />
            ) : (
              <div className="empty-state">
                <p className="text-sm font-bold text-slate-500 mb-4">No products found</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn-luxury-outline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* LOAD MORE */}
            {hasNextPage && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="btn-luxury-outline disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading..." : "Load More"}
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
              className="fixed bottom-0 w-full bg-white p-5 z-50 rounded-t-xl max-h-[80vh] overflow-auto"
            >
              <FilterSidebar
                filters={filterMeta}
                activeFilters={filters}
                onUpdate={updateFilter}
                onClear={clearFilters}
              />

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full mt-4 btn-luxury"
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
