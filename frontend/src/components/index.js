// Centralized component exports (optimized for scalability + clarity)

/* ---------------- UI ---------------- */
export { default as Button } from "./ui/Button";
export { default as Input } from "./ui/Input";
export { default as Modal } from "./ui/Modal";
export { default as LazyImage } from "./ui/LazyImage";
export { default as Avatar } from "./ui/Avatar";
export { default as CouponCard } from "./ui/CouponCard";
export { default as CouponBox } from "./ui/CouponBox";
export { default as WhatsAppButton } from "./ui/WhatsAppButton";
export { default as GlobalLoader } from "./ui/GlobalLoader";
export { default as QuickView } from "./ui/QuickView";

/* Skeleton (FIXED EXPORTS) */
export {
    Skeleton,
    ProductCardSkeleton,
    HeroSkeleton,
    CategorySkeleton,
    OrderSummarySkeleton
} from "./ui/Skeleton";

/* ---------------- LAYOUT ---------------- */
export { default as Layout } from "./layout/Layout";
export { default as Navbar } from "./layout/Navbar";
export { default as Footer } from "./layout/Footer";
export { default as HeroCarousel } from "./layout/HeroCarousel";
export { default as CategorySlider } from "./layout/CategorySlider";
export { default as SectionWrapper } from "./layout/SectionWrapper";
export { default as BottomNav } from "./layout/BottomNav";

/* ---------------- PRODUCT ---------------- */
export { default as ProductCard } from "./ProductCard";
export { default as ProductGrid } from "./ProductGrid";
export { default as ProductTabs } from "./ProductTabs";
export { default as ProductVideo } from "./ProductVideo";
export { default as QuickSizeSelector } from "./QuickSizeSelector";
export { default as CategoryCard } from "./CategoryCard";
export { default as OfferCarousel } from "./OfferCarousel";

/* ---------------- FEATURES ---------------- */
export { default as CartDrawer } from "./cart/CartDrawer";
export { default as OrderSummary } from "./checkout/OrderSummary";
export { default as PaymentMethods } from "./checkout/PaymentMethods";
export { default as CouponSection } from "./checkout/CouponSection";
export { default as AddressManager } from "./AddressManager";
export { default as FilterSidebar } from "./FilterSidebar";
export { default as NotificationsDropdown } from "./NotificationsDropdown";
export { default as FloatingVideo } from "./FloatingVideo";
export { default as MobileStickyATC } from "./MobileStickyATC";
export { default as UrgencyEngine } from "./UrgencyEngine";

/* ---------------- AUTH ---------------- */
export { default as AuthModal } from "./auth/AuthModal";
export { default as ProtectedRoute } from "./auth/ProtectedRoute";

/* ---------------- UTILITIES ---------------- */
export { default as ErrorBoundary } from "./common/ErrorBoundary";
export { default as SafeText } from "./common/SafeText";
export { default as APIStateWrapper } from "./common/APIStateWrapper";
export { default as SEO } from "./SEO";

/* ---------------- HOME ---------------- */
export { default as TrustSection } from "./home/TrustSection";