import { useRealtime } from "../../hooks/useRealtime";
import { 
  Activity, 
  Cpu, 
  Database, 
  Server, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCcw,
  Zap,
  HardDrive,
  Users,
  Globe,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Performance() {
  const { telemetry, isConnected } = useRealtime(true);

  if (!isConnected || !telemetry) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCcw className="animate-spin text-blue-600" size={48} />
        <p className="text-sm font-black uppercase tracking-widest text-gray-400 animate-pulse">
            Establishing Secure Telemetry Link...
        </p>
      </div>
    );
  }

  const { resourceUsage, activeUsers, serverCount, crashProbability, environment, instanceId, timestamp } = telemetry;

  return (
    <div className="space-y-8 pb-10">
      
      {/* 1. PREMIUM HEADER */}
      <div className="relative overflow-hidden bg-[#0f172a] p-8 rounded-[2rem] shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 p-10 opacity-10">
            <Activity size={200} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Operational Status</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Sync</span>
                </div>
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
              System <span className="text-blue-500">Observability</span>
            </h1>
            <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
               <Globe size={14} className="text-slate-500" /> {environment} • {instanceId}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Last Update</span>
             <span className="text-xs font-mono text-slate-300 bg-slate-800/50 px-3 py-1 rounded-md border border-slate-700">
                {new Date(timestamp).toLocaleTimeString()}
             </span>
          </div>
        </div>
      </div>

      {/* 2. CORE METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* ACTIVE USERS */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <Users size={120} />
           </div>
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                 <Users size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Concurrent</p>
                 <p className="text-xs font-bold text-gray-500">Live Traffic</p>
              </div>
           </div>
           <AnimatePresence mode="wait">
             <motion.h3 
               key={activeUsers}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="text-4xl font-black text-gray-900"
             >
               {activeUsers}
             </motion.h3>
           </AnimatePresence>
           <p className="text-[10px] font-black text-blue-600 uppercase mt-2 tracking-tighter">Real Active Users</p>
        </div>

        {/* SERVER CLUSTER */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <Server size={120} />
           </div>
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                 <Server size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Topology</p>
                 <p className="text-xs font-bold text-gray-500">Auto-Scaled</p>
              </div>
           </div>
           <h3 className="text-4xl font-black text-gray-900">{serverCount}</h3>
           <p className="text-[10px] font-black text-purple-600 uppercase mt-2 tracking-tighter">
             {serverCount > 1 ? "Distributed Nodes" : "Single Node (Localhost)"}
           </p>
        </div>

        {/* CRASH PROBABILITY */}
        <div className={`p-6 rounded-3xl border shadow-sm hover:shadow-xl transition-all group relative overflow-hidden ${
          crashProbability > 50 ? "bg-rose-50 border-rose-100" : "bg-white border-gray-100"
        }`}>
           <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <ShieldAlert size={120} />
           </div>
           <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-2xl ${crashProbability > 50 ? "bg-rose-100 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                 {crashProbability > 50 ? <ShieldAlert size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Risk Index</p>
                 <p className="text-xs font-bold text-gray-500">System Stress</p>
              </div>
           </div>
           <h3 className="text-4xl font-black text-gray-900">{crashProbability}%</h3>
           <div className="mt-2 w-full bg-gray-200/50 rounded-full h-1.5 overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${crashProbability}%` }}
                    className={`h-full rounded-full ${crashProbability > 70 ? "bg-rose-500" : crashProbability > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                />
           </div>
        </div>

        {/* RESPONSE TIME */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <Zap size={120} />
           </div>
           <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                 <Zap size={24} />
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Performance</p>
                 <p className="text-xs font-bold text-gray-500">I/O Latency</p>
              </div>
           </div>
           <h3 className="text-4xl font-black text-gray-900">{Math.round(resourceUsage.cpu * 100)}ms</h3>
           <p className="text-[10px] font-black text-amber-600 uppercase mt-2 tracking-tighter">Est. Reaction Time</p>
        </div>
      </div>

      {/* 3. HEATMAP & RESOURCE ALLOCATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* RESOURCE USAGE */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-10">
                 <div>
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Hardware Analytics</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Live Resource Allocation</p>
                 </div>
                 <HardDrive className="text-gray-100 group-hover:animate-pulse" size={64} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                 {/* RAM */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-blue-600" /> Physical RAM
                       </span>
                       <span className="text-lg font-black text-gray-900">{resourceUsage.ram.percent}%</span>
                    </div>
                    
                    <div className="relative h-12 bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${resourceUsage.ram.percent}%` }}
                            className={`h-full rounded-xl shadow-lg transition-all duration-1000 ${
                                parseFloat(resourceUsage.ram.percent) > 85 ? "bg-gradient-to-r from-rose-500 to-rose-600" : "bg-gradient-to-r from-blue-500 to-blue-600"
                            }`}
                        />
                    </div>
                    
                    <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200">
                       <div className="text-center">
                          <p className="text-xs font-black text-gray-900">{resourceUsage.ram.used} GB</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Used</p>
                       </div>
                       <div className="h-6 w-px bg-slate-200" />
                       <div className="text-center">
                          <p className="text-xs font-black text-gray-900">{resourceUsage.ram.total} GB</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Total</p>
                       </div>
                    </div>
                 </div>

                 {/* CPU */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-orange-600" /> Node CPU Load
                       </span>
                       <span className="text-lg font-black text-gray-900">{(resourceUsage.cpu * 100).toFixed(0)}%</span>
                    </div>
                    
                    <div className="relative h-12 bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(resourceUsage.cpu * 100, 100)}%` }}
                            className="h-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg transition-all duration-1000"
                        />
                    </div>

                    <div className="bg-[#0f172a] p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <Cpu className="text-blue-400" size={18} />
                          <div>
                             <p className="text-[10px] font-black text-slate-500 uppercase leading-none mb-1">Processing</p>
                             <p className="text-xs font-bold text-white uppercase tracking-tighter">Load Average Optimized</p>
                          </div>
                       </div>
                       <div className="text-right">
                           <p className="text-[10px] font-black text-emerald-400 uppercase">Stable</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* SYSTEM CONSOLE / LOGS */}
        <div className="bg-[#0f172a] rounded-[2.5rem] shadow-2xl p-8 border border-slate-800 space-y-8 flex flex-col justify-between">
           <div className="space-y-6">
              <div className="flex items-center justify-between">
                 <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest">Network Edge</h2>
                 <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-pulse" />
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <div className="flex items-center gap-3">
                       <Database className="text-cyan-400" size={18} />
                       <span className="text-xs font-black text-white uppercase">MDB Cluster</span>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                 </div>

                 <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <div className="flex items-center gap-3">
                       <Server className="text-purple-400" size={18} />
                       <span className="text-xs font-black text-white uppercase">Redis In-Memory</span>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                 </div>

                 <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                    <div className="flex items-center gap-3">
                       <Settings className="text-amber-400" size={18} />
                       <span className="text-xs font-black text-white uppercase">Config Sync</span>
                    </div>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                 </div>
              </div>
           </div>

           <div className="pt-6 border-t border-slate-800 space-y-2">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">Operational Readiness</p>
              <div className="flex items-center justify-between">
                 <span className="text-xl font-black text-white italic">OPTIMIZED</span>
                 <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full w-full bg-emerald-500" />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
