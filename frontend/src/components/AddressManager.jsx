// FIXED & OPTIMIZED VERSION (FULL CODE)

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
  Home,
  Briefcase,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Edit3,
  X,
  ChevronRight,
  Plus,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "../api/client";
import SafeText from "./common/SafeText";
import { useRef } from "react";

// Leaflet fix
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const INDIA_CENTER = [20.5937, 78.9629];

const AddressManager = ({ onSelect, selectedId }) => {
  const [addresses, setAddresses] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeout = useRef(null);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    label: "Home",
    latitude: INDIA_CENTER[0],
    longitude: INDIA_CENTER[1]
  });

  const [errors, setErrors] = useState({});
  const [mapCenter, setMapCenter] = useState(INDIA_CENTER);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  /* ---------------- FETCH ---------------- */

  const fetchAddresses = useCallback(async () => {
    try {
      const data = await api.get("/auth/addresses");
      const safe = Array.isArray(data) ? data : [];
      setAddresses(safe);

      if (!selectedId && safe.length) {
        const defaultAddr = safe.find((a) => a.isDefault) || safe[0];
        onSelect?.(defaultAddr);
      }
    } catch {
      toast.error("Failed to load saved addresses");
    }
  }, [onSelect, selectedId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  /* ---------------- GEO ---------------- */

  const executeReverseGeocode = async (lat, lng) => {
    setIsResolvingAddress(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      );
      const data = await res.json();

      if (data?.address) {
        const addr = data.address;

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          addressLine1: addr.road || prev.addressLine1,
          city: addr.city || addr.town || prev.city,
          state: addr.state || prev.state,
          pincode: addr.postcode || prev.pincode
        }));
      }
    } catch {
      toast.error("Unable to detect address");
    } finally {
      setIsResolvingAddress(false);
    }
  };

  /* ---------------- SEARCH (DEBOUNCED) ---------------- */

  const handleMapSearch = (value) => {
    setSearchQuery(value);

    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      if (!value.trim()) return;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            value
          )}&format=json&limit=1`
        );
        const data = await res.json();

        if (data?.length) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);

          setMapCenter([lat, lon]);
          await executeReverseGeocode(lat, lon);
        }
      } catch {
        toast.error("Location search failed");
      }
    }, 600);
  };

  /* ---------------- VALIDATION ---------------- */

  const validate = () => {
    const e = {};

    if (!formData.fullName.trim()) e.fullName = "Enter full name";
    if (formData.phone.length !== 10) e.phone = "Enter valid phone";
    if (!formData.addressLine1.trim()) e.addressLine1 = "Enter address";
    if (!formData.city.trim()) e.city = "Enter city";
    if (!formData.state.trim()) e.state = "Enter state";
    if (formData.pincode.length !== 6) e.pincode = "Invalid pincode";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      let saved;

      if (editingId) {
        saved = await api.put(`/auth/addresses/${editingId}`, formData);
        setAddresses((prev) =>
          prev.map((a) => (a._id === editingId ? saved : a))
        );
      } else {
        saved = await api.post("/auth/addresses", formData);
        setAddresses((prev) => [...prev, saved]);
      }

      toast.success("Address saved");
      onSelect?.(saved);
      setIsAdding(false);
      setEditingId(null);
    } catch {
      toast.error("Failed to save address");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">

      {/* LIST */}
      {!isAdding && (
        <div className="space-y-4">
          {addresses.map((addr) => (
            <div
              key={addr._id}
              onClick={() => onSelect?.(addr)}
              className={`p-4 border rounded-xl cursor-pointer ${selectedId === addr._id
                  ? "border-black bg-slate-50"
                  : "border-slate-200"
                }`}
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{addr.fullName}</p>
                  <p className="text-sm text-slate-500">
                    {addr.addressLine1}, {addr.city}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(addr._id);
                    setFormData(addr);
                    setIsAdding(true);
                  }}
                >
                  <Edit3 size={16} />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 border border-dashed rounded-lg text-sm"
          >
            + Add new address
          </button>
        </div>
      )}

      {/* FORM */}
      {isAdding && (
        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            placeholder="Full Name"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            className="input"
          />

          <input
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData({
                ...formData,
                phone: e.target.value.replace(/\D/g, "").slice(0, 10)
              })
            }
            className="input"
          />

          <input
            placeholder="Search location"
            value={searchQuery}
            onChange={(e) => handleMapSearch(e.target.value)}
            className="input"
          />

          {/* MAP */}
          <div className="h-60 rounded-lg overflow-hidden">
            <MapContainer center={mapCenter} zoom={15} className="h-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationMarker
                position={[formData.latitude, formData.longitude]}
                setPosition={(pos) => executeReverseGeocode(pos[0], pos[1])}
              />
            </MapContainer>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white rounded-lg"
          >
            {loading ? "Saving..." : "Save Address"}
          </button>
        </form>
      )}
    </div>
  );
};

/* ---------------- MAP MARKER ---------------- */

const LocationMarker = ({ position, setPosition }) => {
  const map = useMap();

  useEffect(() => {
    map.setView(position);
  }, [position, map]);

  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    }
  });

  return <Marker position={position} draggable />;
};

export default React.memo(AddressManager);