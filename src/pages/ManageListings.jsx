import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { Plus, Pencil, Trash2, Loader2, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";

const LIFESTYLE_TAG_OPTIONS = [
  "near_mrt", "quiet", "greenery", "near_schools", "near_mall",
  "near_hawker", "near_hospital", "low_crime", "new_development", "waterfront"
];

const emptyForm = {
  title: "",
  address: "",
  price: "",
  num_bedrooms: 3,
  property_type: "hdb",
  description: "",
  location_area: "",
  floor_area_sqm: "",
  lifestyle_tags: [],
  photos: [],
};

export default function ManageListings() {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const loadListings = async (userId) => {
    const data = await base44.entities.PropertyListing.filter({ agent_id: userId });
    setListings(data);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const me = await base44.auth.me();
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
      price: Number(form.price),
      num_bedrooms: Number(form.num_bedrooms),
      floor_area_sqm: form.floor_area_sqm ? Number(form.floor_area_sqm) : undefined,
      agent_id: user.id,
      status: "active",
    };

    if (editing) {
      await base44.entities.PropertyListing.update(editing.id, data);
      toast.success("Listing updated");
    } else {
      const created = await base44.entities.PropertyListing.create(data);
      toast.success("Listing created — computing amenities...");
      fetch("/api/precompute-single-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: created.id }),
      }).catch(() => {});
    }

    setDialogOpen(false);
    setEditing(null);
    setForm({ ...emptyForm });
    setSaving(false);
    await loadListings(user.id);
  };

  const handleDelete = async (id) => {
    await base44.entities.PropertyListing.delete(id);
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
      lifestyle_tags: listing.lifestyle_tags || [],
      photos: listing.photos || [],
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
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, photos: [...f.photos, file_url] }));
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
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Block 123, Tampines St 11" />
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
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="text-sm" />
                {form.photos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {form.photos.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
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
              {listing.photos?.[0] && (
                <img src={listing.photos[0]} alt="" className="w-full h-40 object-cover" />
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
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" onClick={() => openEdit(listing)} className="gap-1">
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 gap-1" onClick={() => handleDelete(listing.id)}>
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