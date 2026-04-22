import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { mapProduct } from "../api/dynamicMapper";
import { ArrowRight, Star, Sparkles } from "lucide-react";
import { formatPrice } from "../utils/format";
import SafeImage from "./common/SafeImage";

export default function CategoryCard({
  category = "",
  image,
  tag = "",
  desc = ""
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  /* ---------------- FETCH ---------------- */

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get(
        `/products?category=${category}&sort=topSelling&limit=3`
      );

      const raw =
        (Array.isArray(res) && res) ||
        res?.data ||
        res?.products ||
        res?.items ||
        [];

      const mapped = raw.map(mapProduct).filter(Boolean);

      setProducts(mapped);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (category) fetchProducts();
  }, [fetchProducts, category]);

  /* ---------------- UI ---------------- */

  const handleNavigate = () => {
    if (!category) return;
    navigate(`/collection?category=${category}`);
  };

  const ProductPreview = ({ product }) => (
    <Link
      to={`/product/${product.id}`}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-white/10 transition active:scale-95"
    >
      <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden border border-white/10">
        <SafeImage
          src={product.images?.[0] || product.image}
          alt={product.title}
          className="w-full h-full object-cover"
        />
      </div>

      <span className="text-[10px] font-semibold text-white">
        {formatPrice(product.price)}
      </span>

      {product?.ratings?.average > 0 && (
        <div className="flex items-center gap-1">
          <Star size={10} className="text-yellow-400 fill-yellow-400" />
          <span className="text-[9px] text-yellow-300">
            {product.ratings.average.toFixed(1)}
          </span>
        </div>
      )}
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">

      {/* MAIN CARD */}
      <div
        onClick={handleNavigate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleNavigate()}
        className="group relative h-[240px] md:h-[300px] rounded-2xl overflow-hidden cursor-pointer border border-slate-200 bg-slate-100"
      >
        {/* IMAGE */}
        <SafeImage
          src={image}
          alt={category}
          className="w-full h-full object-cover transition duration-700 group-hover:scale-110"
        />

        {/* OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* TEXT */}
        <div className="absolute bottom-0 p-6 text-white space-y-2">
          <span className="text-xs uppercase text-indigo-400 font-semibold">
            {tag}
          </span>

          <h2 className="text-2xl md:text-4xl font-bold leading-tight">
            {category}
          </h2>

          <p className="text-xs text-white/70 max-w-xs">
            {desc}
          </p>

          <div className="flex items-center gap-2 pt-2 text-sm font-medium">
            Shop now <ArrowRight size={14} />
          </div>
        </div>

        {/* HOVER CONTENT (DESKTOP) */}
        <div className="absolute inset-0 hidden md:flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition">
          <div className="text-center space-y-4 p-4 w-full">

            <p className="text-xs text-white/70 uppercase tracking-wider">
              Popular in this category
            </p>

            <div className="grid grid-cols-3 gap-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-14 h-14 bg-white/10 rounded-lg animate-pulse"
                  />
                ))
                : products.map((p) => (
                  <ProductPreview key={p.id} product={p} />
                ))}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigate();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-slate-100 transition"
            >
              View all <Sparkles size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE */}
      <div className="md:hidden space-y-2 px-1">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Top picks</span>
          <Link
            to={`/collection?category=${category}`}
            className="text-indigo-600"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-slate-100 rounded-lg animate-pulse"
              />
            ))
            : products.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="relative aspect-square rounded-lg overflow-hidden"
              >
                <SafeImage
                  src={p.images?.[0] || p.image}
                  alt={p.title}
                  className="w-full h-full object-cover"
                />

                <div className="absolute bottom-0 w-full bg-black/60 text-center text-[10px] text-white py-1">
                  {formatPrice(p.price)}
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}