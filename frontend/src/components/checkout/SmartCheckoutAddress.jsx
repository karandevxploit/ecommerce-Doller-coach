import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  Navigation,
  Loader2,
  CheckCircle2,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../../api/client";

import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const INDIA_CENTER = [28.6139, 77.209];

const initialForm = {
  name: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  lat: INDIA_CENTER[0],
  lng: INDIA_CENTER[1],
};

const safeNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidAddress = (form) => {
  return (
    form.name.trim() &&
    form.phone.replace(/\D/g, "").length === 10 &&
    form.address.trim() &&
    form.city.trim() &&
    form.state.trim() &&
    form.pincode.replace(/\D/g, "").length === 6
  );
};

const buildPayload = (form) => ({
  fullName: form.name.trim(),
  phone: form.phone.trim(),
  addressLine1: form.address.trim(),
  city: form.city.trim(),
  state: form.state.trim(),
  pincode: form.pincode.trim(),
  latitude: safeNumber(form.lat, INDIA_CENTER[0]),
  longitude: safeNumber(form.lng, INDIA_CENTER[1]),
});

export default function SmartCheckoutAddress({ onAddressComplete = () => { } }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const valid = useMemo(() => isValidAddress(form), [form]);

  const updateForm = useCallback((patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchSavedAddress = async () => {
      setFetching(true);

      try {
        const res = await api.get("/address");
        const addr = res?.data?.data || res?.data?.address || res?.data;

        if (!mounted || !addr) return;

        updateForm({
          name: addr.fullName || addr.name || "",
          phone: String(addr.phone || "").replace(/\D/g, "").slice(0, 10),
          address: addr.addressLine1 || addr.address || "",
          city: addr.city || "",
          state: addr.state || "",
          pincode: String(addr.pincode || "").replace(/\D/g, "").slice(0, 6),
          lat: safeNumber(addr.latitude, INDIA_CENTER[0]),
          lng: safeNumber(addr.longitude, INDIA_CENTER[1]),
        });
      } catch (err) {
        console.error("ADDRESS_FETCH_ERROR:", err?.response?.data || err?.message);
      } finally {
        if (mounted) setFetching(false);
      }
    };

    fetchSavedAddress();

    return () => {
      mounted = false;
    };
  }, [updateForm]);

  const saveToBackend = useCallback(async (data) => {
    try {
      setSaving(true);
      await api.post("/address", data);
    } catch (err) {
      console.error("ADDRESS_SAVE_ERROR:", err?.response?.data || err?.message);
    } finally {
      setSaving(false);
    }
  }, []);

  const handlePincodeChange = async (value) => {
    const pin = value.replace(/\D/g, "").slice(0, 6);
    updateForm({ pincode: pin });

    if (pin.length !== 6) return;

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();

      if (data?.[0]?.Status === "Success" && data?.[0]?.PostOffice?.[0]) {
        const info = data[0].PostOffice[0];

        updateForm({
          city: info.District || "",
          state: info.State || "",
        });

        toast.success(`Detected ${info.District}, ${info.State}`);
      }
    } catch (err) {
      console.error("PINCODE_LOOKUP_ERROR:", err);
    }
  };

  const handleMapClick = useCallback(
    async (lat, lng) => {
      updateForm({ lat, lng });

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        );
        const data = await res.json();

        if (data?.address) {
          const address = data.address;

          updateForm({
            address: address.road || address.suburb || address.neighbourhood || "",
            city: address.city || address.town || address.village || "",
            state: address.state || "",
            pincode: String(address.postcode || "").replace(/\D/g, "").slice(0, 6),
            lat,
            lng,
          });
        }
      } catch (err) {
        console.error("REVERSE_GEOCODE_ERROR:", err);
      }
    },
    [updateForm]
  );

  const detectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();

          updateForm({
            address: data.locality || data.city || "",
            city: data.city || data.locality || "",
            state: data.principalSubdivision || "",
            pincode: String(data.postcode || "").replace(/\D/g, "").slice(0, 6),
            lat: latitude,
            lng: longitude,
          });

          setDetected(true);
          toast.success("Location detected");
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
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (!query) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=1&countrycodes=in`
      );
      const data = await res.json();

      if (data?.length) {
        const lat = safeNumber(data[0].lat, INDIA_CENTER[0]);
        const lon = safeNumber(data[0].lon, INDIA_CENTER[1]);
        await handleMapClick(lat, lon);
      } else {
        toast.error("Location not found");
      }
    } catch {
      toast.error("Search failed");
    }
  };

  useEffect(() => {
    if (!valid) {
      onAddressComplete(null);
      return;
    }

    const payload = buildPayload(form);
    onAddressComplete(payload);

    const timer = setTimeout(() => {
      saveToBackend(payload);
    }, 2000);

    return () => clearTimeout(timer);
  }, [form, valid, onAddressComplete, saveToBackend]);

  return (
    <div className="relative bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tighter">
          Delivery Address
        </h2>
        {detected && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-widest">
            <CheckCircle2 size={12} /> Location Verified
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
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

          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search for area, landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </form>

          <div className="h-[200px] rounded-2xl overflow-hidden border border-slate-100 shadow-inner z-0">
            <MapContainer center={[form.lat, form.lng]} zoom={13} className="h-full w-full">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={[form.lat, form.lng]} />
              <Marker position={[form.lat, form.lng]} />
              <MapEvents onMapClick={handleMapClick} />
            </MapContainer>
          </div>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            Tap map to adjust pin precisely
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Full Name
              </label>
              <input
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="Receiver's name"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) =>
                  updateForm({ phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                }
                placeholder="10-digit number"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Full Address
            </label>
            <textarea
              value={form.address}
              onChange={(e) => updateForm({ address: e.target.value })}
              placeholder="Flat, House no., Building, Company, Apartment"
              className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                City
              </label>
              <input
                list="indiaCities"
                value={form.city}
                onChange={(e) => updateForm({ city: e.target.value })}
                placeholder="City"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                State
              </label>
              <input
                value={form.state}
                onChange={(e) => updateForm({ state: e.target.value })}
                placeholder="State"
                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Pincode (Auto-fills City/State)
            </label>
            <input
              value={form.pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
              placeholder="6-digit code"
              className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:border-black transition-all"
            />
          </div>

          <datalist id="indiaCities">
            <option value="Mumbai" />
            <option value="Delhi" />
            <option value="Bangalore" />
            <option value="Hyderabad" />
            <option value="Ahmedabad" />
            <option value="Chennai" />
            <option value="Kolkata" />
            <option value="Surat" />
            <option value="Pune" />
            <option value="Jaipur" />
          </datalist>
        </div>
      </div>

      {(fetching || saving) && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center backdrop-blur-sm z-50 rounded-2xl">
          <Loader2 className="animate-spin text-black" size={24} />
        </div>
      )}
    </div>
  );
}

function MapEvents({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapController({ center }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);

  return null;
}
