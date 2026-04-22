import { useState, useMemo } from "react";
import { ChevronDown, RotateCcw, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Slider from "rc-slider";

export default function FilterSidebar({
  filters = {},
  activeFilters = {},
  onUpdate,
  onClear
}) {
  const minPrice = Number(filters?.priceRange?.min || 0);
  const maxPrice = Number(filters?.priceRange?.max || 5000);

  const currentMin = Number(activeFilters?.minPrice ?? minPrice);
  const currentMax = Number(activeFilters?.maxPrice ?? maxPrice);

  const safeCategories = useMemo(
    () => filters?.categories || [],
    [filters]
  );

  const safeColors = useMemo(
    () => filters?.colors || [],
    [filters]
  );

  const safeSizes = useMemo(
    () => filters?.sizes || [],
    [filters]
  );

  const handlePriceChange = (values) => {
    if (!Array.isArray(values)) return;
    onUpdate?.("minPrice", values[0]);
    onUpdate?.("maxPrice", values[1]);
  };

  const isChecked = (key, value) => {
    const list = activeFilters?.[key];
    return Array.isArray(list) && list.includes(value);
  };

  return (
    <aside className="space-y-8" aria-label="Product filters">

      {/* HEADER */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">Filters</h3>

        <button
          onClick={onClear}
          aria-label="Clear filters"
          className="flex items-center gap-1 text-xs text-indigo-600 hover:text-slate-900"
        >
          <RotateCcw size={14} />
          Clear
        </button>
      </div>

      {/* CATEGORY */}
      <FilterSection title="Category">
        <div className="space-y-2">
          {safeCategories.map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-3 cursor-pointer text-sm text-slate-600"
            >
              <input
                type="checkbox"
                checked={isChecked("category", cat)}
                onChange={() => onUpdate?.("category", cat)}
                className="h-4 w-4 accent-indigo-600"
              />
              {cat}
            </label>
          ))}
        </div>
      </FilterSection>

      {/* COLORS */}
      <FilterSection title="Color">
        <div className="flex flex-wrap gap-3">
          {safeColors.map((col) => (
            <button
              key={col.name}
              onClick={() => onUpdate?.("color", col.name)}
              aria-label={`Filter by ${col.name}`}
              className={`w-8 h-8 rounded-full border ${isChecked("color", col.name)
                  ? "border-black scale-110"
                  : "border-slate-200"
                }`}
              style={{ backgroundColor: col.code || "#eee" }}
            />
          ))}
        </div>
      </FilterSection>

      {/* SIZE */}
      <FilterSection title="Size">
        <div className="grid grid-cols-3 gap-2">
          {safeSizes.map((size) => (
            <button
              key={size}
              onClick={() => onUpdate?.("size", size)}
              className={`py-2 text-sm rounded-md border ${isChecked("size", size)
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
            >
              {size}
            </button>
          ))}
        </div>
      </FilterSection>

      {/* RATING */}
      <FilterSection title="Rating">
        <div className="space-y-2">
          {[4, 3, 2].map((r) => (
            <label
              key={r}
              className="flex items-center gap-3 cursor-pointer text-sm"
            >
              <input
                type="radio"
                name="rating"
                checked={Number(activeFilters?.rating) === r}
                onChange={() => onUpdate?.("rating", r)}
              />
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < r ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                    }
                  />
                ))}
                <span className="text-slate-600">& up</span>
              </div>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* PRICE */}
      <FilterSection title="Price">
        <div className="space-y-4 px-1">
          <div className="flex justify-between text-sm text-slate-600">
            <span>₹{currentMin}</span>
            <span>₹{currentMax}</span>
          </div>

          <Slider
            range
            min={minPrice}
            max={maxPrice}
            step={100}
            value={[currentMin, currentMax]}
            onChange={handlePriceChange}
          />
        </div>
      </FilterSection>
    </aside>
  );
}

/* ---------------- SECTION ---------------- */

function FilterSection({ title, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between text-sm font-medium text-slate-900 mb-2"
      >
        {title}
        <ChevronDown
          size={16}
          className={`transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}