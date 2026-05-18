import { Link } from "react-router-dom";
import { FaInstagram, FaYoutube, FaXTwitter } from "react-icons/fa6";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import ScrollingBrandBanner from "./ScrollingBrandBanner";

const SHOP_LINKS = [
  { to: "/collection/men", label: "Men" },
  { to: "/collection/women", label: "Women" },
  { to: "/collection/new-arrivals", label: "New Arrivals" },
  { to: "/collection/best-sellers", label: "Best Sellers" },
];

const SUPPORT_LINKS = [
  { to: "/contact", label: "Contact Us" },
  { to: "/shipping", label: "Shipping Info" },
  { to: "/returns", label: "Returns & Exchanges" },
];

const SOCIAL_LINKS = [
  { href: "#", label: "Instagram", Icon: FaInstagram },
  { href: "#", label: "YouTube", Icon: FaYoutube },
  { href: "#", label: "Twitter", Icon: FaXTwitter },
];

const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
};

export default function Footer() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (event) => {
    event.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      toast.error("Please enter your email.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 800));

      toast.success("You're subscribed. Stay tuned for updates.");
      setEmail("");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="bg-white text-slate-900 border-t border-slate-100 overflow-hidden">
      <ScrollingBrandBanner />

      <div className="container-responsive py-5 md:py-7">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-12 gap-x-8 gap-y-4 lg:gap-5">
          <div className="col-span-2 lg:col-span-5 flex flex-col items-start gap-2.5 pr-0 lg:pr-12">
            <Link to="/" className="inline-block group">
              <h2 className="text-lg md:text-xl font-black tracking-tighter uppercase transition-colors hover:text-gray-600">
                Doller Coach
              </h2>
            </Link>

            <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed max-w-sm">
              Discover everyday fashion designed for comfort, style, and confidence.
              Modern aesthetics built for real people and real life.
            </p>

            <div className="flex items-center gap-4 pt-1">
              {SOCIAL_LINKS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="text-slate-400 hover:text-black transition-colors duration-300"
                  target={href === "#" ? undefined : "_blank"}
                  rel={href === "#" ? undefined : "noreferrer"}
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-2.5">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">
              Shop
            </h4>
            <ul className="flex flex-col gap-1.5 text-xs text-slate-500">
              {SHOP_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-black transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">
                Support
              </h4>
              <ul className="flex flex-col gap-1.5 text-xs text-slate-500">
                {SUPPORT_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="hover:text-black transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleSubscribe} className="space-y-2 w-full">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-900 block">
                Newsletter
              </label>
              <div className="relative group flex items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email Address"
                  aria-label="Email address"
                  disabled={loading}
                  className="w-full text-xs bg-transparent border-b border-slate-300 py-2 pr-10 text-slate-900 focus:outline-none focus:border-black transition-colors duration-300 placeholder:text-slate-400 disabled:opacity-60"
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

      <div className="border-t border-slate-100 py-3">
        <div className="container-responsive flex flex-col md:flex-row items-center justify-between gap-2 md:gap-4">
          <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider text-center">
            © {currentYear} Doller Coach. All rights reserved.
          </p>

          <div className="flex items-center gap-4 md:gap-6 text-[10px] md:text-xs text-slate-400 uppercase tracking-wider">
            <Link to="/privacy" className="hover:text-black transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-black transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
