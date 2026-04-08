import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Home, Briefcase, Trash2, CheckCircle2, AlertCircle, Loader2, Search, Edit3, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

// Fix Leaflet icon issue
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const AddressManager = ({ onSelect, selectedId }) => {
  const [addresses, setAddresses] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
    label: 'Home',
    latitude: 20.5937,
    longitude: 78.9629
  });

  const [errors, setErrors] = useState({});
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const data = await api.get('/auth/addresses') || [];
      setAddresses(Array.isArray(data) ? data : []);
      if (!selectedId && data.length > 0) {
        const defaultAddr = data.find(a => a.isDefault) || data[0];
        onSelect(defaultAddr);
      }
    } catch {
      toast.error("Cloud address sync failure");
    }
  };

  const formatPhone = (val) => {
    if (!val) return "";
    const str = String(val);
    const cleaned = str.replace(/\D/g, '').slice(0, 10);
    if (cleaned.length > 5) {
      return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    return cleaned;
  };

  const handlePincodeChange = async (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, pincode: cleaned }));
    
    if (cleaned.length === 6) {
      setPincodeLoading(true);
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`);
        const data = await res.json();
        if (data[0].Status === "Success") {
          const postOffice = data[0].PostOffice[0];
          setFormData(prev => ({
            ...prev,
            city: postOffice.District || prev.city,
            state: postOffice.State || prev.state
          }));
          setErrors(prev => ({ ...prev, pincode: '', city: '', state: '' }));
          toast.success(`Located: ${postOffice.District}`);
        } else {
          setErrors(prev => ({ ...prev, pincode: 'Invalid Indian Pincode' }));
        }
      } catch {
        // Silent fail on lookup
      } finally {
        setPincodeLoading(false);
      }
    }
  };

  const validate = () => {
    const next = {};
    if (!formData.name.trim()) next.name = "Full name is required";
    if (formData.phone.replace(/\s/g, '').length !== 10) next.phone = "10-digit phone required";
    if (!formData.addressLine1.trim()) next.addressLine1 = "Street address is required";
    if (!formData.city.trim()) next.city = "City is required";
    if (!formData.state.trim()) next.state = "State is required";
    if (formData.pincode.length !== 6) next.pincode = "6-digit pincode required";
    
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleEdit = (addr, e) => {
    e.stopPropagation();
    setEditingId(addr._id || addr.id);
    setFormData({
      name: addr.name || '',
      phone: formatPhone(addr.phone || ''),
      addressLine1: addr.addressLine1 || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
      label: addr.label || 'Home',
      latitude: addr.latitude || 20.5937,
      longitude: addr.longitude || 78.9629
    });
    setMapCenter([addr.latitude || 20.5937, addr.longitude || 78.9629]);
    setIsAdding(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return toast.error("Please fill all required fields correctly");
    
    setLoading(true);
    const payload = { 
      ...formData, 
      phone: formData.phone.replace(/\s/g, '') // Send clean phone to backend
    };

    try {
      if (editingId) {
        const updated = await api.put(`/auth/addresses/${editingId}`, payload);
        setAddresses(prev => prev.map(a => (a._id || a.id) === editingId ? updated : a));
        onSelect(updated);
        toast.success("Destination Updated");
      } else {
        const saved = await api.post('/auth/addresses', payload);
        setAddresses(prev => [...prev, saved]);
        onSelect(saved);
        toast.success("New Destination Saved");
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({
        name: '', phone: '', addressLine1: '', city: '', state: '', pincode: '',
        label: 'Home', latitude: 20.5937, longitude: 78.9629
      });
    } catch {
      toast.error(err.response?.data?.message || "Failed to persist address");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Permanently remove this destination?")) return;
    try {
      await api.delete(`/auth/addresses/${id}`);
      setAddresses(prev => prev.filter(a => (a._id || a.id) !== id));
      toast.success("Address Purged");
    } catch {
      toast.error("Purge failure");
    }
  };

  const handleAutoLocate = () => {
    if (!navigator.geolocation) return toast.error("GPS not supported by browser");
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        setMapCenter([latitude, longitude]);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
          const data = await res.json();
          if (data.address) {
            const addr = data.address;
            setFormData(prev => ({
              ...prev,
              addressLine1: data.display_name || prev.addressLine1,
              city: addr.city || addr.town || addr.village || prev.city,
              state: addr.state || prev.state,
              pincode: addr.postcode || prev.pincode
            }));
          }
        } catch {} finally { setGeoLoading(false); }
      },
      () => { setGeoLoading(false); toast.error("GPS access blocked"); }
    );
  };

  return (
    <div className="space-y-6">
      {!isAdding && (
        <div className="grid grid-cols-1 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr._id || addr.id}
              onClick={() => onSelect(addr)}
              className={`group relative p-6 rounded-3xl border-2 transition-all cursor-pointer ${
                selectedId === (addr._id || addr.id)
                  ? 'border-black bg-zinc-50 shadow-luxury-sm'
                  : 'border-zinc-100 hover:border-zinc-300 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div className={`mt-1 p-2.5 rounded-2xl ${selectedId === (addr._id || addr.id) ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                    {addr.label === 'Work' ? <Briefcase size={20} /> : <Home size={20} />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black text-xs uppercase tracking-widest text-zinc-900">{addr.name}</h4>
                      {addr.isDefault && <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-zinc-900 text-white px-2 py-0.5 rounded-full">Primary</span>}
                    </div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">+{formatPhone(addr.phone)}</p>
                    <p className="text-sm font-bold text-zinc-600 mt-3 leading-relaxed max-w-[280px]">
                      {addr.addressLine1}<br/>
                      <span className="text-zinc-400">{addr.city}, {addr.state} — </span>
                      <span className="text-black font-black">{addr.pincode}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                   <div className={`transition-all duration-500 ${selectedId === (addr._id || addr.id) ? 'scale-110' : 'opacity-0 scale-50 group-hover:opacity-20 group-hover:scale-90'}`}>
                      <CheckCircle2 size={24} className="text-black" />
                   </div>
                   <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity translate-y-4 group-hover:translate-y-0 duration-300">
                      <button onClick={(e) => handleEdit(addr, e)} className="p-2.5 bg-white border border-zinc-100 rounded-xl text-zinc-400 hover:text-black hover:border-black transition-all shadow-sm">
                        <Edit3 size={16} />
                      </button>
                      <button onClick={(e) => handleDelete(addr._id || addr.id, e)} className="p-2.5 bg-white border border-zinc-100 rounded-xl text-zinc-400 hover:text-red-500 hover:border-red-500 transition-all shadow-sm">
                        <Trash2 size={16} />
                      </button>
                   </div>
                </div>
              </div>
            </div>
          ))}
          
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ ...formData, name: '', phone: '', addressLine1: '', city: '', state: '', pincode: '' }); }}
            className="w-full py-6 rounded-3xl border-2 border-dashed border-zinc-200 text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em] hover:border-black hover:text-black hover:bg-zinc-50 transition-all flex items-center justify-center gap-3 group"
          >
            <div className="w-8 h-8 rounded-full border-2 border-zinc-200 flex items-center justify-center group-hover:border-black transition-all">
              <Plus size={16} />
            </div>
            Construct New Shipping Lane
          </button>
        </div>
      )}

      {isAdding && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex items-center justify-between mb-8 border-b border-zinc-100 pb-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-zinc-900">
                {editingId ? "Update Target" : "Define Source"}
              </h3>
              <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mt-1">Shipping Logistics Hub</p>
            </div>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="p-2 rounded-xl bg-zinc-100 text-zinc-400 hover:bg-black hover:text-white transition-all">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="h-[280px] w-full rounded-3xl overflow-hidden border-2 border-zinc-100 relative group shadow-inner">
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationMarker 
                  position={[formData.latitude, formData.longitude]} 
                  setPosition={(pos) => setFormData(p => ({ ...p, latitude: pos[0], longitude: pos[1] }))} 
                />
              </MapContainer>
              <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-white/50 text-[9px] font-black uppercase tracking-widest text-zinc-400 shadow-sm">
                Precision Geo-Lock Active
              </div>
              <button
                type="button"
                onClick={handleAutoLocate}
                disabled={geoLoading}
                className="absolute bottom-4 right-4 z-[400] bg-black text-white p-4 rounded-2xl shadow-luxury-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-3 font-black text-[10px] tracking-widest"
              >
                {geoLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                SYNC GPS
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-3">
                <FloatingInput label="Receiver Full Name" value={formData.name} onChange={v => setFormData({...formData, name: v})} error={errors.name} />
              </div>
              <div className="md:col-span-2">
                <FloatingInput label="Active Phone" value={formData.phone} onChange={v => setFormData({...formData, phone: formatPhone(v)})} error={errors.phone} placeholder="98765 43210" icon={<span className="text-[10px] font-black text-zinc-300 ml-4">+91</span>} />
              </div>
            </div>

            <FloatingInput label="Precision Street / Area Line" value={formData.addressLine1} onChange={v => setFormData({...formData, addressLine1: v})} error={errors.addressLine1} icon={<MapPin size={18} className="text-zinc-300 ml-4" />} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="relative group/pin">
                  <FloatingInput label="PIN Code" value={formData.pincode} onChange={handlePincodeChange} error={errors.pincode} icon={pincodeLoading ? <Loader2 size={18} className="animate-spin text-zinc-300 ml-4" /> : <ChevronRight size={18} className="text-zinc-300 ml-4" />} />
               </div>
               <FloatingInput label="Target City" value={formData.city} onChange={v => setFormData({...formData, city: v})} error={errors.city} />
               <FloatingInput label="District State" value={formData.state} onChange={v => setFormData({...formData, state: v})} error={errors.state} />
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center pt-4">
              <div className="flex bg-zinc-100 p-1.5 rounded-2xl w-full md:w-auto">
                {['Home', 'Work'].map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setFormData({...formData, label: t})}
                    className={`flex-1 md:px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      formData.label === t ? 'bg-white text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              
              <button
                type="submit" disabled={loading}
                className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-[0.25em] text-[10px] hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-luxury-lg"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                {editingId ? "Update Authorization" : "Confirm Destination"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// COMPONENT UPGRADES
const FloatingInput = ({ label, value, onChange, error, icon, placeholder }) => {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className="relative group">
      <div className={`relative flex items-center bg-white border-2 rounded-2xl transition-all duration-500 ${
        error ? 'border-red-500 bg-red-50/10' : isFocused ? 'border-black ring-4 ring-zinc-50' : 'border-zinc-100'
      }`}>
        {icon}
        <input
          type="text"
          value={value}
          placeholder={isFocused ? (placeholder || "") : ""}
          className="w-full px-5 py-5 text-xs font-bold bg-transparent outline-none pt-7 text-zinc-900"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className={`absolute left-5 transition-all duration-500 pointer-events-none uppercase tracking-[0.2em] font-black text-[9px] ${
          isFocused || value ? '-translate-y-4 text-zinc-400' : 'translate-y-0 text-zinc-300'
        } ${icon ? 'ml-6' : ''}`}>
          {label}
        </label>
        {error && (
          <div className="absolute right-5 text-red-500">
            <AlertCircle size={18} />
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1.5 mt-2 ml-4">
           <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
           <p className="text-[9px] text-red-600 font-black uppercase tracking-widest">{error}</p>
        </div>
      )}
    </div>
  );
};

const LocationMarker = ({ position, setPosition }) => {
  const map = useMap();
  useMapEvents({ click(e) { const { lat, lng } = e.latlng; setPosition([lat, lng]); } });
  useEffect(() => { map.flyTo(position, map.getZoom(), { duration: 1.5 }); }, [position, map]);
  return <Marker position={position} draggable={true} eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); setPosition([lat, lng]); } }} />;
};

const Plus = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
const ShieldCheck = ({ size }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;

export default React.memo(AddressManager);
