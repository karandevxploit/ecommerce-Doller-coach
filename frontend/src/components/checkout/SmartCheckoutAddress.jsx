import React, { useState, useEffect, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap
} from "react-leaflet";
import L from "leaflet";
import {
  MapPin,
  Navigation,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Home,
  Briefcase,
  Search
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../api/client";

// Leaflet fix for default icon
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const INDIA_CENTER = [28.6139, 77.2090]; // New Delhi

const SmartCheckoutAddress = ({ onAddressComplete }) => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    lat: INDIA_CENTER[0],
    lng: INDIA_CENTER[1]
  });

  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  /* ---------------- AUTO DETECT ---------------- */
  const detectLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();

          setForm((prev) => ({
            ...prev,
            address: data.locality || data.city || "",
            city: data.city || "",
            state: data.principalSubdivision || "",
            pincode: data.postcode || "",
            lat: latitude,
            lng: longitude
          }));
          setDetected(true);
          toast.success("Location detected ✅");
        } catch (err) {
          toast.error("Failed to fetch address details");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        toast.error("Permission denied");
      },
      { timeout: 10000 }
    );
  };

  /* ---------------- MAP SYNC ---------------- */
  const handleMapClick = async (lat, lng) => {
    setForm(prev => ({ ...prev, lat, lng }));
    
    // Optional: reverse geocode on click
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      if (data?.address) {
        const a = data.address;
        setForm(prev => ({
          ...prev,
          address: a.road || a.suburb || prev.address,
          city: a.city || a.town || a.village || prev.city,
          state: a.state || prev.state,
          pincode: a.postcode || prev.pincode,
          lat,
          lng
        }));
      }
    } catch {}
  };

  /* ---------------- SEARCH ---------------- */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
      const data = await res.json();
      if (data?.length) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        handleMapClick(lat, lon);
      }
    } catch {
      toast.error("Search failed");
    }
  };

  /* ---------------- VALIDATION ---------------- */
  const isValid = 
    form.name.trim() && 
    form.phone.length >= 10 && 
    form.address.trim() && 
    form.city.trim() && 
    form.state.trim() && 
    form.pincode.length === 6;

  useEffect(() => {
    if (isValid) {
      onAddressComplete({
        fullName: form.name,
        phone: form.phone,
        addressLine1: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        latitude: form.lat,
        longitude: form.lng
      });
    } else {
      onAddressComplete(null);
    }
  }, [form, isValid, onAddressComplete]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tighter">Delivery Address</h2>
        {detected && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-widest">
            <CheckCircle2 size={12} /> Location Verified
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* LEFT: MAP & AUTO DETECT */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={detectLocation}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 h-12 bg-black text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Navigation size={16} />}
            {loading ? "Detecting..." : "Use Current Location (1-Click)"}
          </button>

          <div onSubmit={handleSearch} className="relative">
            <input 
              type="text"
              placeholder="Search for area, landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
              className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </div>

          <div className="h-64 rounded-2xl overflow-hidden border border-slate-100 shadow-inner z-0">
            <MapContainer center={[form.lat, form.lng]} zoom={13} className="h-full w-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapController center={[form.lat, form.lng]} />
              <Marker position={[form.lat, form.lng]} />
              <MapEvents onMapClick={handleMapClick} />
            </MapContainer>
          </div>
          
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            Tap map to adjust pin precisely
          </p>
        </div>

        {/* RIGHT: MANUAL FORM */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Receiver's name"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="10-digit number"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Address</label>
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Flat, House no., Building, Company, Apartment"
              className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="City"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">State</label>
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                placeholder="State"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pincode</label>
            <input
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              placeholder="6-digit code"
              className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- SUB-COMPONENTS ---------------- */

const MapEvents = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const MapController = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
};

export default SmartCheckoutAddress;
