import { useState, useMemo } from "react";
import { ChevronDown, RotateCcw, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Slider from "rc-slider";

const safeArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const splitFilter = (value) => {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toggleCsvValue = (currentValue, nextValue) => {
  const value = String(nextValue);
  const list = splitFilter(currentValue);

  if (list.includes(value)) {
    return list.filter((item) => item !== value).join(",");
  }

  return [...list, value].join(",");
};

const getCategoryId = (category) => {
  if (category && typeof category === "object") {
    return String(category._id || category.id || category.slug || category.name || "");
  }

  return String(category || "");
};

const getCategoryName = (category) => {
  if (category && typeof category === "object") {
    return String(category.name || category.label || category.title || "Category");
  }

  return String(category || "Category");
};

const isSafeCssColor = (color) => {
  return /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color) || /^[a-zA-Z]+$/.test(color);
};

export default function FilterSidebar({
  filters = {},
  activeFilters = {},
  onUpdate,
  onClear,
}) {
  const rawMinPrice = safeNumber(filters?.minPrice, 0);
  const rawMaxPrice = safeNumber(filters?.maxPrice, 10000);

  const minPrice = Math.min(rawMinPrice, rawMaxPrice);
  const maxPrice = Math.max(rawMinPrice, rawMaxPrice, minPrice + 1);

  const currentMin = Math.max(
    minPrice,
    Math.min(safeNumber(activeFilters?.minPrice, minPrice), maxPrice)
  );
  const currentMax = Math.min(
    maxPrice,
    Math.max(safeNumber(activeFilters?.maxPrice, maxPrice), currentMin)
  );

  const safeCategories = useMemo(() => safeArray(filters?.categories), [filters]);
  const safeColors = useMemo(() => safeArray(filters?.colors), [filters]);
  const safeSizes = useMemo(() => safeArray(filters?.sizes), [filters]);
  const safeGenders = useMemo(() => safeArray(filters?.genders), [filters]);

  const handlePriceChange = (values) => {
    if (!Array.isArray(values)) return;

    const nextMin = safeNumber(values[0], minPrice);
    const nextMax = safeNumber(values[1], maxPrice);

    onUpdate?.("minPrice", nextMin);
    onUpdate?.("maxPrice", nextMax);
  };

  const handleToggle = (key, value) => {
    const next = toggleCsvValue(activeFilters?.[key], value);
    onUpdate?.(key, next);
  };

  const isChecked = (key, value) => {
    return splitFilter(activeFilters?.[key]).includes(String(value));
  };

  const priceStep = Math.max(1, Math.ceil((maxPrice - minPrice) / 20));

  return (
    <aside className="space-y-6" aria-label="Product filters">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Refine By
        </h3>

        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-black transition-colors"
        >
          <RotateCcw size={12} />
          RESET
        </button>
      </div>

      {safeGenders.length > 0 && (
        <FilterSection title="Gender">
          <div className="space-y-2">
            {safeGenders.map((gender) => (
              <label key={gender} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="gender"
                  checked={activeFilters.gender === gender}
                  onChange={() => onUpdate?.("gender", gender)}
                  className="h-4 w-4 accent-black"
                />
                <span className="text-sm text-slate-600 group-hover:text-black capitalize">
                  {gender}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {safeCategories.length > 0 && (
        <FilterSection title="Category">
          <div className="space-y-2">
            {safeCategories.map((category) => {
              const categoryId = getCategoryId(category);
              const categoryName = getCategoryName(category);

              return (
                <label key={categoryId} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isChecked("category", categoryId)}
                    onChange={() => handleToggle("category", categoryId)}
                    className="h-4 w-4 rounded accent-black"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-black capitalize">
                    {categoryName}
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>
      )}

      {safeColors.length > 0 && (
        <FilterSection title="Color">
          <div className="flex flex-wrap gap-2.5">
            {safeColors.map((color) => {
              const colorValue = String(color);
              const backgroundColor = isSafeCssColor(colorValue)
                ? colorValue.toLowerCase()
                : "#e2e8f0";

              return (
                <button
                  key={colorValue}
                  type="button"
                  onClick={() => handleToggle("colors", colorValue)}
                  title={colorValue}
                  aria-label={`Filter by color ${colorValue}`}
                  className={`w-7 h-7 rounded-full border-2 transition-transform active:scale-95 ${isChecked("colors", colorValue)
                    ? "border-black scale-110 shadow-sm"
                    : "border-slate-100"
                    }`}
                  style={{
                    backgroundColor,
                    boxShadow: isChecked("colors", colorValue)
                      ? "0 0 0 1px white inset"
                      : "none",
                  }}
                />
              );
            })}
          </div>
        </FilterSection>
      )}

      {safeSizes.length > 0 && (
        <FilterSection title="Size">
          <div className="grid grid-cols-3 gap-2">
            {safeSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleToggle("sizes", size)}
                className={`py-2 text-[10px] font-black uppercase tracking-tighter rounded border transition-all ${isChecked("sizes", size)
                  ? "bg-black text-white border-black"
                  : "border-slate-200 text-slate-500 hover:border-black hover:text-black"
                  }`}
              >
                {size}
              </button>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title="Rating">
        <div className="space-y-3">
          {[4, 3, 2].map((rating) => (
            <label key={rating} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="radio"
                name="rating"
                checked={Number(activeFilters?.rating) === rating}
                onChange={() => onUpdate?.("rating", rating)}
                className="h-4 w-4 accent-black"
              />
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, index) => (
                  <Star
                    key={index}
                    size={12}
                    className={
                      index < rating ? "text-yellow-400 fill-yellow-400" : "text-slate-200"
                    }
                  />
                ))}
                <span className="text-[11px] font-bold text-slate-400 ml-1">
                  & up
                </span>
              </div>
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Availability">
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="availability"
              checked={activeFilters?.availability === "in_stock"}
              onChange={() => onUpdate?.("availability", "in_stock")}
              className="h-4 w-4 accent-black"
            />
            <span className="text-sm text-slate-600">In Stock</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="availability"
              checked={activeFilters?.availability === "out_of_stock"}
              onChange={() => onUpdate?.("availability", "out_of_stock")}
              className="h-4 w-4 accent-black"
            />
            <span className="text-sm text-slate-600">Out of Stock</span>
          </label>

          <button
            type="button"
            onClick={() => onUpdate?.("availability", "")}
            className="text-xs text-indigo-600 hover:text-black"
          >
            Clear
          </button>
        </div>
      </FilterSection>

      <FilterSection title="Price Range">
        <div className="space-y-5 px-1 pt-2">
          <Slider
            range
            min={minPrice}
            max={maxPrice}
            step={priceStep}
            value={[currentMin, currentMax]}
            onChange={handlePriceChange}
            trackStyle={[{ backgroundColor: "#000" }]}
            handleStyle={[
              { borderColor: "#000", backgroundColor: "#fff" },
              { borderColor: "#000", backgroundColor: "#fff" },
            ]}
          />
          <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
            <span className="text-[10px] font-black">₹{currentMin}</span>
            <span className="w-4 h-[1px] bg-slate-300" />
            <span className="text-[10px] font-black">₹{currentMax}</span>
          </div>
        </div>
      </FilterSection>
    </aside>
  );
}

function FilterSection({ title, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between text-sm font-medium text-slate-900 mb-1"
      >
        {title}
        <ChevronDown
          size={16}
          className={`transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence initial={false}>
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
