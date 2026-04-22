import { motion } from "framer-motion";
import { Star, ShieldCheck, Truck, Clock, Users, ArrowRight } from "lucide-react";

const REVIEWS = [
  {
    id: 1,
    name: "Aryan Sharma",
    role: "Fashion Creator",
    text: "The quality of these fabrics is unparalleled. It's not just clothing, it's an architectural statement. Absolutely obsessed with the Midnight Collection.",
    rating: 5,
  },
  {
    id: 2,
    name: "Sneha Kapoor",
    role: "Style Consultant",
    text: "Finally a brand that understands minimalist luxury. The fits are perfect and the delivery was incredibly fast. 10/10 recommendation.",
    rating: 5,
  },
  {
    id: 3,
    name: "Vikram Mehta",
    role: "Entreprenuer",
    text: "Shopping here is a seamless experience. The trust badges aren't just for show—the customer support is world-class. Worth every penny.",
    rating: 5,
  }
];

export default function TrustSection() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 space-y-20">

        {/* Metric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Users, title: "10,000+", subtitle: "Global Architects", color: "text-indigo-600" },
            { icon: Star, title: "4.8/5", subtitle: "Average Rating", color: "text-amber-500" },
            { icon: ShieldCheck, title: "100%", subtitle: "Authentic Quality", color: "text-emerald-500" },
            { icon: Truck, title: "Express", subtitle: "World Shipping", color: "text-blue-500" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center space-y-4 p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500"
            >
              <div className={`p-5 rounded-3xl bg-white shadow-inner ${item.color}`}>
                <item.icon size={32} strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{item.title}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{item.subtitle}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Review Slider Logic (Simplified for Demo) */}
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-[1px] w-8 bg-indigo-600 rounded-full" />
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Voices of the community</span>
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase leading-[0.8]">
                Real Stories. <br /> <span className="text-slate-200">Real Impact.</span>
              </h2>
            </div>
            <button className="flex items-center gap-3 text-[10px] font-black text-slate-950 uppercase tracking-[0.2em] group">
              Read All Reviews <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {REVIEWS.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-slate-100 p-8 md:p-12 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all duration-700 space-y-8 flex flex-col"
              >
                <div className="flex gap-1 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="currentColor" />)}
                </div>
                <p className="text-lg font-medium text-slate-700 leading-relaxed italic flex-1">
                  "{review.text}"
                </p>
                <div className="flex items-center gap-4 pt-6 border-t border-slate-50">
                  <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400">
                    {review.name[0]}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{review.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{review.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
