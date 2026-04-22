import { Link } from "react-router-dom";
import {
  FaInstagram,
  FaYoutube,
  FaXTwitter
} from "react-icons/fa6";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import ScrollingBrandBanner from "./ScrollingBrandBanner";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubscribe = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      return toast.error("Please enter your email.");
    }

    if (!isValidEmail(email)) {
      return toast.error("Enter a valid email address.");
    }

    try {
      setLoading(true);

      // Simulate API
      await new Promise((res) => setTimeout(res, 800));

      toast.success("You're subscribed. Stay tuned for updates.");
      setEmail("");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-white text-slate-900 border-t border-slate-100 overflow-hidden">
      <ScrollingBrandBanner />
      <div className="container-responsive py-20">
        
        {/* 3 COLUMN LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
          
          {/* COLUMN 1: BRANDING & SOCIAL */}
          <div className="lg:col-span-5 flex flex-col items-start gap-6 pr-0 lg:pr-12">
            <Link to="/" className="inline-block group">
              <h2 className="text-2xl font-black tracking-tighter uppercase transition-colors hover:text-gray-600">
                Doller Coach
              </h2>
            </Link>
            
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
              Discover everyday fashion designed for comfort, style, and confidence. Modern aesthetics built for real people and real life.
            </p>

            {/* SOCIAL PROOF / STRIP */}
            <div className="flex items-center gap-6 pt-4">
              <a href="#" aria-label="Instagram" className="text-slate-400 hover:text-black transition-colors duration-300">
                <FaInstagram size={18} />
              </a>
              <a href="#" aria-label="YouTube" className="text-slate-400 hover:text-black transition-colors duration-300">
                <FaYoutube size={18} />
              </a>
              <a href="#" aria-label="Twitter" className="text-slate-400 hover:text-black transition-colors duration-300">
                <FaXTwitter size={18} />
              </a>
            </div>
          </div>

          {/* COLUMN 2: SHOPPING LINKS */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">
              Shop
            </h4>
            <ul className="flex flex-col gap-4 text-sm text-slate-500">
              <li><Link to="/collection/men" className="hover:text-black transition-colors">Men</Link></li>
              <li><Link to="/collection/women" className="hover:text-black transition-colors">Women</Link></li>
              <li><Link to="/collection/new-arrivals" className="hover:text-black transition-colors">New Arrivals</Link></li>
              <li><Link to="/collection/best-sellers" className="hover:text-black transition-colors">Best Sellers</Link></li>
            </ul>
          </div>

          {/* COLUMN 3: HELP & NEWSLETTER */}
          <div className="lg:col-span-4 flex flex-col gap-8">
            <div className="flex flex-col gap-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">
                Support
              </h4>
              <ul className="flex flex-col gap-4 text-sm text-slate-500">
                <li><Link to="/contact" className="hover:text-black transition-colors">Contact Us</Link></li>
                <li><Link to="/shipping" className="hover:text-black transition-colors">Shipping Info</Link></li>
                <li><Link to="/returns" className="hover:text-black transition-colors">Returns & Exchanges</Link></li>
              </ul>
            </div>

            {/* SUBSCRIBE ROW */}
            <form onSubmit={handleSubscribe} className="space-y-4 w-full">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-900 block">
                Newsletter
              </label>
              <div className="relative group flex items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  aria-label="Email address"
                  className="w-full text-sm bg-transparent border-b border-slate-300 py-3 pr-12 text-slate-900 focus:outline-none focus:border-black transition-colors duration-300 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={loading}
                  aria-label="Subscribe"
                  className="absolute right-0 text-slate-400 group-hover:text-black group-focus-within:text-black transition-colors disabled:opacity-50"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

      {/* COPYRIGHT */}
      <div className="border-t border-slate-100 pb-8 pt-8">
        <div className="container-responsive flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            © {currentYear} Doller Coach. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-slate-400 uppercase tracking-wider">
            <Link to="/privacy" className="hover:text-black transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-black transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}