import { GoogleOAuthProvider } from "@react-oauth/google";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, Suspense, lazy } from "react";
import Layout from "./components/layout/Layout";
import { useAuthStore, useCartStore, useWishlistStore } from "./store";
import GlobalLoader from "./components/ui/GlobalLoader";
import { useState } from "react";

// Lazy Loaded User Pages
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

// Lazy Loaded Admin Imports
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const AdminRoute = lazy(() => import("./admin/AdminRoute"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminRegister = lazy(() => import("./pages/admin/AdminRegister"));
const Dashboard = lazy(() => import("./admin/Dashboard"));
const Products = lazy(() => import("./admin/pages/Products"));
const Orders = lazy(() => import("./admin/pages/Orders"));
const Users = lazy(() => import("./admin/pages/Users"));
const Offers = lazy(() => import("./admin/pages/Offers"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const Checkout = lazy(() => import("./pages/Checkout"));
const AdminReviews = lazy(() => import("./admin/pages/Reviews"));
const AdminSettings = lazy(() => import("./admin/pages/Settings"));



function App() {
  const { fetchCart } = useCartStore();
  const { fetchWishlist } = useWishlistStore();
  const { isAuthenticated, fetchUser } = useAuthStore();

  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          await fetchUser();
        }
      } catch {
        console.error("Initialization failed:", err);
      } finally {
        setTimeout(() => setIsInitializing(false), 800); // Small delay for brand consistency
      }
    };
    init();
  }, [fetchUser]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCart();
      fetchWishlist();
    }
  }, [isAuthenticated, fetchCart, fetchWishlist]);

  return (
    <GoogleOAuthProvider clientId="536224738397-ht6q3v710gdjb0a9ulr9okjsuv9sh7sg.apps.googleusercontent.com">
      <GlobalLoader isVisible={isInitializing} />
      <BrowserRouter>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[80vh] bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1e3a8a]"></div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="verify" element={<VerifyOtp />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="verify-reset-otp" element={<VerifyResetOtp />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="cart" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wishlist" element={<Wishlist />} />
            <Route path="search" element={<Search />} />
            <Route path="collection" element={<Collection />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="order-success/:id" element={<OrderSuccess />} />
            <Route path="product/:id" element={<ProductPage />} />
          </Route>

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="orders" element={<Orders />} />
            <Route path="users" element={<Users />} />
            <Route path="offers" element={<Offers />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </Suspense>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
