import { Link } from "react-router-dom";
import { 
  Mail, 
  MapPin, 
  Phone, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck,
  Globe
} from "lucide-react";
import { FaInstagram, FaTwitter, FaFacebook } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const handleSubscribe = (e) => {
    e.preventDefault();
    toast.success("Welcome to the inner circle.");
  };

  return (
    <footer className="bg-[#0f172a] text-white pt-16 pb-12 font-sans border-t border-white/5">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-8 pb-16">

          {/* Brand Identity */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-white text-[#0f172a] shadow-lg group-hover:scale-105 transition-transform">
                <span className="text-lg font-black italic">D</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tighter text-white uppercase leading-none">
                  DOLLER <span className="text-blue-500">Coach</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400 mt-2">
                  (By Gangwani and Company)
                </span>
              </div>
            </Link>

            <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-xs">
              Crafting minimalist luxury for the modern era. Precision in every stitch. Power in every layer.
            </p>

            {/* Verified Social Logic */}
            <div className="flex items-center gap-5 pt-4">
              {[
                { icon: <FaInstagram size={18} />, href: "https://www.instagram.com/doller_coach?igsh=MTNoMHp0OHo5cjJjZA==", label: "Instagram" },
                { icon: <FaTwitter size={18} />, href: "https://x.com/DollerCoach", label: "X (Twitter)" },
                { icon: <FaFacebook size={18} />, href: "https://www.facebook.com/share/14Y4KM9RNEw/", label: "Facebook" }
              ].map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-xl bg-white/5 text-gray-400 hover:text-white hover:bg-blue-600 hover:-translate-y-1 transition-all duration-300 border border-white/5"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation Segments */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              Exploration
            </h4>
            <ul className="space-y-4">
              {[
                { name: "Men's Collection", path: "/collection?category=Men" },
                { name: "Women's Collection", path: "/collection?category=Women" },
                { name: "New Arrivals", path: "/collection" },
                { name: "Trending", path: "/collection?trending=true" }
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.path}
                    className="text-sm font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              Client Service
            </h4>
            <ul className="space-y-4">
              {[
                "Contact Us",
                "Shipping & Delivery",
                "Returns & Exchanges",
                "Privacy Policy"
              ].map((item) => (
                <li key={item}>
                  <Link
                    to="/"
                    className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter Section */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              Newsletter
            </h4>
            <p className="text-sm text-gray-400 font-medium leading-relaxed">
              Join for exclusive invitations to new collection launches.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="relative group">
                <input
                  type="email"
                  placeholder="Your Email"
                  className="w-full h-12 bg-white/5 border border-white/10 rounded-full px-6 text-sm font-medium text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full h-12 bg-white text-[#0f172a] font-bold uppercase tracking-widest text-xs rounded-full shadow-lg hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Join Now <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Tier */}
        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-sm font-medium text-gray-500">
            © {currentYear} DOLLER Coach. Premium Fashion Architecture.
          </div>

          <div className="flex items-center gap-8">
            <div className="flex gap-4 text-gray-600">
              <Globe size={18} className="hover:text-blue-500 transition-colors" />
              <ShieldCheck size={18} className="hover:text-blue-500 transition-colors" />
              <Mail size={18} className="hover:text-blue-500 transition-colors" />
            </div>

            <div className="hidden sm:flex gap-6 text-sm font-medium text-gray-500">
              <Link to="/" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}