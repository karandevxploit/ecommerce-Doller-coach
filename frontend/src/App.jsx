import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, Suspense, lazy } from "react";
import Layout from "./components/layout/Layout";
import {
  useAuthStore,
  useCartStore,
  useWishlistStore,
} from "./store";
import GlobalLoader from "./components/ui/GlobalLoader";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ScrollToTop from "./components/utils/ScrollToTop";

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
        <a
          href="/"
          className="text-black underline"
        >
          Go back home
        </a>
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
const SiteContentManager = lazy(() => import("./admin/pages/SiteContentManager"));

/* ---------------- ROOT REDIRECT ---------------- */
function RootRedirect() {
  const { isInitialized } = useAuthStore();

  if (!isInitialized) {
    return <GlobalLoader isVisible />;
  }

  return <Home />;
}

/* ---------------- APP ---------------- */
function App() {
  const {
    isAuthenticated,
    isInitialized,
    fetchUser,
  } = useAuthStore();

  const fetchCart = useCartStore(
    (s) => s.fetchCart
  );
  const fetchWishlist = useWishlistStore(
    (s) => s.fetchWishlist
  );

  /* ---------------- INIT AUTH ---------------- */
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  /* ---------------- LOAD USER DATA ---------------- */
  useEffect(() => {
    if (!isInitialized || !isAuthenticated) return;

    fetchCart();
    fetchWishlist();
  }, [isInitialized, isAuthenticated, fetchCart, fetchWishlist]);

  /* ---------------- BLOCK UI UNTIL READY ---------------- */
  if (!isInitialized) {
    return <GlobalLoader isVisible />;
  }

  return (
    <BrowserRouter>
      <ScrollToTop />

      <Suspense fallback={<GlobalLoader isVisible />}>
        <Routes>
          {/* USER ROUTES */}
          <Route path="/" element={<Layout />}>
            <Route index element={<RootRedirect />} />

            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="verify" element={<VerifyOtp />} />
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
            <Route path="collection/:category" element={<Collection />} />

            <Route
              path="my-orders"
              element={
                <ProtectedRoute role="user">
                  <MyOrders />
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

            <Route path="product/:id" element={<ProductPage />} />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Route>

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
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;