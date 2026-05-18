import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { useEffect, Suspense, lazy } from "react";
import { Toaster } from "react-hot-toast";
import Layout from "./components/layout/Layout";
import {
  useAuthStore,
  useCartStore,
  useWishlistStore,
} from "./store";
import GlobalLoader from "./components/ui/GlobalLoader";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ScrollToTop from "./components/utils/ScrollToTop";
import { ErrorBoundary } from "./components/common/ErrorBoundary";

/* ---------------- ERROR FALLBACK ---------------- */
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center px-4">
      <div>
        <h1 className="text-xl font-semibold mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-500 mb-4">
          Please refresh the page or try again later.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-black text-white rounded"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

/* ---------------- 404 PAGE ---------------- */
function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-center">
      <div>
        <h1 className="text-2xl font-semibold mb-2">
          Page not found
        </h1>
        <p className="text-gray-500 mb-4">
          The page you are looking for doesn’t exist.
        </p>
        <Link to="/" className="text-black underline">
          Go back home
        </Link>
      </div>
    </div>
  );
}

/* ---------------- LAZY PAGES ---------------- */
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Cart = lazy(() => import("./pages/Cart"));
const Profile = lazy(() => import("./pages/Profile"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const VerifyOtp = lazy(() => import("./pages/VerifyOtp"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const VerifyResetOtp = lazy(() => import("./pages/VerifyResetOtp"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Search = lazy(() => import("./pages/Search"));
const Collection = lazy(() => import("./pages/Collection"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const Checkout = lazy(() => import("./pages/Checkout"));

/* ADMIN */
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminRegister = lazy(() => import("./pages/admin/AdminRegister"));
const Dashboard = lazy(() => import("./admin/Dashboard"));
const Products = lazy(() => import("./admin/pages/Products"));
const Orders = lazy(() => import("./admin/pages/Orders"));
const Users = lazy(() => import("./admin/pages/Users"));
const Offers = lazy(() => import("./admin/pages/Offers"));
const AdminReviews = lazy(() => import("./admin/pages/Reviews"));
const AdminSettings = lazy(() => import("./admin/pages/Settings"));
const SiteContentManager = lazy(() =>
  import("./admin/pages/SiteContentManager")
);
const Categories = lazy(() => import("./admin/pages/Categories"));
const Shipments = lazy(() => import("./admin/pages/Shipments"));

/* ---------------- APP ROUTES ---------------- */
function AppRoutes() {
  return (
    <>
      <ScrollToTop />

      <ErrorBoundary fallback={<ErrorFallback />}>
        <Suspense fallback={<GlobalLoader isVisible />}>
          <Routes>
            {/* ADMIN AUTH */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />

            {/* ADMIN ROUTES */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="users" element={<Users />} />
              <Route path="offers" element={<Offers />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="site-content" element={<SiteContentManager />} />
              <Route path="categories" element={<Categories />} />
              <Route path="shipments" element={<Shipments />} />
            </Route>

            {/* USER ROUTES */}
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />

              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />

              {/* OTP aliases */}
              <Route path="verify" element={<VerifyOtp />} />
              <Route path="verify-otp" element={<VerifyOtp />} />

              <Route path="forgot-password" element={<ForgotPassword />} />
              <Route path="verify-reset-otp" element={<VerifyResetOtp />} />
              <Route path="reset-password" element={<ResetPassword />} />

              <Route path="cart" element={<Cart />} />

              <Route
                path="checkout"
                element={
                  <ProtectedRoute role="user">
                    <Checkout />
                  </ProtectedRoute>
                }
              />

              <Route
                path="profile"
                element={
                  <ProtectedRoute role="user">
                    <Profile />
                  </ProtectedRoute>
                }
              />

              <Route path="wishlist" element={<Wishlist />} />
              <Route path="search" element={<Search />} />
              <Route path="collection" element={<Collection />} />
              <Route path="collection/:gender" element={<Collection />} />
              <Route path="category/:gender" element={<Collection />} />
              <Route path="product/:id" element={<ProductPage />} />

              <Route
                path="my-orders"
                element={
                  <ProtectedRoute role="user">
                    <MyOrders />
                  </ProtectedRoute>
                }
              />

              <Route
                path="order-success"
                element={
                  <ProtectedRoute role="user">
                    <OrderSuccess />
                  </ProtectedRoute>
                }
              />

              <Route
                path="order-success/:id"
                element={
                  <ProtectedRoute role="user">
                    <OrderSuccess />
                  </ProtectedRoute>
                }
              />

              <Route
                path="order/:id"
                element={
                  <ProtectedRoute role="user">
                    <OrderSuccess />
                  </ProtectedRoute>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* GLOBAL 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

/* ---------------- APP ---------------- */
function App() {
  const {
    isAuthenticated,
    isInitialized,
    fetchUser,
  } = useAuthStore();

  const fetchCart = useCartStore((state) => state.fetchCart);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);

  /* ---------------- INIT AUTH ---------------- */
  useEffect(() => {
    Promise.resolve(fetchUser?.()).catch(() => {});

    const timer = setTimeout(() => {
      const state = useAuthStore.getState?.();
      if (state && !state.isInitialized) {
        useAuthStore.setState({
          isInitialized: true,
          loading: false,
          isFetchingUser: false,
        });
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [fetchUser]);

  /* ---------------- LOAD USER DATA ---------------- */
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    fetchCart?.();
    fetchWishlist?.();
  }, [isInitialized, isAuthenticated, fetchCart, fetchWishlist]);

  /* ---------------- BLOCK UI UNTIL READY ---------------- */
  if (!isInitialized) {
    return <GlobalLoader isVisible />;
  }

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster
        position="top-right"
        containerStyle={{
          top: "100px",
          right: "20px",
          zIndex: 99999,
        }}
        toastOptions={{
          duration: 4500,
          className:
            "rounded-xl bg-white text-slate-900 border shadow-2xl px-4 py-3 text-xs font-bold",
          style: { zIndex: 99999 },
          error: {
            duration: 7000,
            className:
              "rounded-xl bg-red-50 text-red-900 border border-red-200 shadow-2xl px-4 py-3 text-xs font-bold",
          },
          success: {
            className:
              "rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-2xl px-4 py-3 text-xs font-bold",
          },
        }}
      />
    </BrowserRouter>
  );
}

export default App;
