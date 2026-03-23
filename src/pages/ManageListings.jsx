import React, { useState, useEffect, useRef } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Building2, MapPin, Eye, Heart } from "lucide-react";
import { supabase } from "@/api/apiClient";
import { toast } from "sonner";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

const LIFESTYLE_TAG_OPTIONS = [
  "near_mrt", "quiet", "greenery", "near_schools", "near_mall",
  "near_hawker", "near_hospital", "low_crime", "new_development", "waterfront"
];

const emptyForm = {
  title: "",
  address: "",
  lat: null,
  lng: null,
  floor_number: "",
  unit_number: "",
  price: "",
  num_bedrooms: 3,
  property_type: "hdb",
  description: "",
  location_area: "",
  floor_area_sqm: "",
  lifestyle_tags: [],
  photos: [],
};

function AddressAutocomplete({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handleClick = (e) => { if (!wrapperRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`
        );
        const data = await res.json();
        setSuggestions(data.results?.slice(0, 6) || []);
        setOpen(true);
      } catch {}
      setLoading(false);
    }, 300);
  };

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange(q);
    search(q);
  };

  const handleSelect = (result) => {
    const addr = result.ADDRESS;
    setQuery(addr);
    setSuggestions([]);
    setOpen(false);
    onSelect({ address: addr, lat: parseFloat(result.LATITUDE), lng: parseFloat(result.LONGITUDE) });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search Singapore address..."
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((r, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(r)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 border-b border-slate-50 last:border-0"
            >
              <span className="font-medium text-slate-800">{r.BUILDING !== "NIL" ? r.BUILDING : r.ROAD_NAME}</span>
              <span className="block text-xs text-slate-400 truncate">{r.ADDRESS}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ManageListings() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [swipeStats, setSwipeStats] = useState({});

  const loadListings = async (userId) => {
    const data = await api.entities.PropertyListing.filter({ agent_id: userId });
    setListings(data);
    setLoading(false);

    if (data.length > 0) {
      const ids = data.map(l => l.id);
      const { data: swipes } = await supabase.from('swipes').select('listing_id, direction').in('listing_id', ids);
      const stats = {};
      for (const s of (swipes || [])) {
        if (!stats[s.listing_id]) stats[s.listing_id] = { views: 0, likes: 0 };
        stats[s.listing_id].views++;
        if (s.direction === 'right') stats[s.listing_id].likes++;
      }
      setSwipeStats(stats);
    }
  };

  useEffect(() => {
    const init = async () => {
      const me = await api.auth.me();
      setUser(me);
      await loadListings(me.id);
    };
    init();
  }, []);

  const handleSave = async () => {
    if (!form.title || !form.address || !form.price) {
      toast.error("Please fill in title, address, and price");
      return;
    }
    setSaving(true);
    const { photos, ...formData } = form;
    const data = {
      ...formData,
      photos: form.photos,
      price: Number(form.price),
      num_bedrooms: Number(form.num_bedrooms),
      floor_area_sqm: form.floor_area_sqm ? Number(form.floor_area_sqm) : undefined,
      agent_id: user.id,
      status: "active",
    };

    if (editing) {
      await api.entities.PropertyListing.update(editing.id, data);
      toast.success("Listing updated");
    } else {
      const created = await api.entities.PropertyListing.create(data);
      if (form.lat && form.lng) {
        toast.success("Listing created!");
      } else {
        toast.success("Listing created — computing amenities...");
        fetch("/api/precompute-single-listing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: created.id }),
        }).catch(() => {});
      }
    }

    setDialogOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
    setSaving(false);
    await loadListings(user.id);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await api.entities.PropertyListing.delete(id);
    toast.success("Listing deleted");
    await loadListings(user.id);
  };

  const openEdit = (listing) => {
    setEditing(listing);
    setForm({
      title: listing.title || "",
      address: listing.address || "",
      price: listing.price || "",
      num_bedrooms: listing.num_bedrooms || 3,
      property_type: listing.property_type || "hdb",
      description: listing.description || "",
      location_area: listing.location_area || "",
      floor_area_sqm: listing.floor_area_sqm || "",
      floor_number: listing.floor_number || "",
      unit_number: listing.unit_number || "",
      lifestyle_tags: listing.lifestyle_tags || [],
      photos: listing.photos || [],
      lat: listing.lat || null,
      lng: listing.lng || null,
    });
    setDialogOpen(true);
  };

  const toggleTag = (tag) => {
    setForm((f) => ({
      ...f,
      lifestyle_tags: f.lifestyle_tags.includes(tag)
        ? f.lifestyle_tags.filter((t) => t !== tag)
        : [...f.lifestyle_tags, tag],
    }));
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
  
    for (const file of files) {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
  
      setForm((f) => ({
        ...f,
        photos: [...f.photos, file_url],
      }));
    }
  };

  const removePhoto = async (index) => {
    const url = form.photos[index];
  
    console.log("Deleting URL:", url);
  
    try {
      const path = getPathFromUrl(url);
      console.log("Extracted path:", path);
  
      const { data, error } = await supabase.storage
        .from("uploads")
        .remove([path]);
  
      console.log("Delete response:", data, error);
  
      if (error) {
        throw error;
      }
  
      setForm((f) => ({
        ...f,
        photos: f.photos.filter((_, i) => i !== index),
      }));
  
    } catch (err) {
      console.error("Failed to delete photo:", err);
      toast.error("Failed to delete photo");
    }
  };

  const getPathFromUrl = (url) => {
    const parts = url.split("/uploads/");
    return parts[1]; // removes "uploads/"
  };

  const typeLabels = { hdb: "HDB", condo: "Condo", landed: "Landed", executive_condo: "EC" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
          <p className="text-slate-500 mt-1">Add, edit, and manage your property listings.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) { setEditing(null); setForm({ ...emptyForm }); }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-orange-600 hover:bg-orange-500 gap-2">
              <Plus className="w-4 h-4" /> Add Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Listing" : "New Listing"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-sm mb-1 block">Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Spacious 4-Room HDB in Tampines" />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Address *</Label>
                <AddressAutocomplete
                  value={form.address}
                  onChange={(address) => setForm((f) => ({ ...f, address, lat: null, lng: null }))}
                  onSelect={({ address, lat, lng }) => setForm((f) => ({ ...f, address, lat, lng }))}
                />
                {form.lat && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location confirmed ({form.lat.toFixed(4)}, {form.lng.toFixed(4)})
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1 block">Floor</Label>
                  <Input placeholder="e.g. 12" value={form.floor_number} onChange={(e) => setForm({ ...form, floor_number: e.target.value })} />
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Unit</Label>
                  <Input placeholder="e.g. 34" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1 block">Price (SGD) *</Label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Floor Area (sqm)</Label>
                  <Input type="number" value={form.floor_area_sqm} onChange={(e) => setForm({ ...form, floor_area_sqm: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1 block">Bedrooms</Label>
                  <Select value={String(form.num_bedrooms)} onValueChange={(v) => setForm({ ...form, num_bedrooms: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Type</Label>
                  <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hdb">HDB</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="landed">Landed</SelectItem>
                      <SelectItem value="executive_condo">Executive Condo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1 block">Location Area</Label>
                <Input value={form.location_area} onChange={(e) => setForm({ ...form, location_area: e.target.value })} placeholder="e.g. Tampines" />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label className="text-sm mb-1 block">Lifestyle Tags</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {LIFESTYLE_TAG_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        form.lifestyle_tags.includes(tag)
                          ? "bg-orange-50 border-indigo-200 text-orange-700"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {tag.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm mb-1 block">Photos</Label>
                <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="text-sm" />
                {form.photos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {form.photos.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} className="w-16 h-16 rounded-lg object-cover" />
                        
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-orange-600 hover:bg-orange-500">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editing ? "Update Listing" : "Create Listing"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-medium text-slate-700">No listings yet</h3>
          <p className="text-sm text-slate-500 mt-1">Create your first property listing to start receiving matches.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {listings.map((listing) => (
            <Card key={listing.id} className="border-slate-100 overflow-hidden">
              
              {listing.photos?.length > 0 && (
                <div className="relative h-40 w-full overflow-hidden">
                  <Swiper
                    modules={[Navigation]}
                    navigation
                    slidesPerView={1}
                    className="w-full h-full"
                  >
                    {listing.photos.map((url, idx) => (
                      <SwiperSlide key={idx}>
                        <img
                          src={url}
                          alt={`photo-${idx}`}
                          className="w-full h-full object-cover"
                        />
                      </SwiperSlide>
                    ))}
                  </Swiper>

                  {/* optional overlay (for consistency with other pages) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

                  <div className="absolute bottom-2 left-3 right-3 z-10">
                    <p className="text-white font-semibold text-sm line-clamp-1">
                      {listing.title}
                    </p>
                    <p className="text-white/70 text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {listing.address}
                    </p>
                  </div>
                </div>
              )}

              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{listing.title}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{listing.address}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[listing.property_type] || listing.property_type}
                  </Badge>
                </div>
                <p className="font-bold text-lg mt-2">${listing.price?.toLocaleString()}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Eye className="w-3.5 h-3.5" />{swipeStats[listing.id]?.views ?? 0} views
                  </span>
                  <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                    <Heart className="w-3.5 h-3.5" />{swipeStats[listing.id]?.likes ?? 0} likes
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEdit(listing)} className="gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 gap-1" onClick={() => handleDelete(listing.id, listing.title)}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}