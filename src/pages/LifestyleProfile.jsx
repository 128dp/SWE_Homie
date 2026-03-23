import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Save, Check, Loader2, Train, Bus, Trees, GraduationCap, UtensilsCrossed, ShoppingCart, Hospital, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import TownRanker from "@/components/profile/TownRanker";
import ImportantPlaces from "@/components/profile/ImportantPlaces";

const WALK_ONLY = [
  { key: "mrt", label: "MRT Station", icon: Train, walkOnly: true },
  { key: "bus", label: "Bus Stop", icon: Bus, walkOnly: true },
];

const AMENITIES = [
  { key: "parks", label: "Parks / Gardens", icon: Trees },
  { key: "hawker", label: "Hawker Centres", icon: UtensilsCrossed },
  { key: "supermarket", label: "Supermarket", icon: ShoppingCart },
  { key: "hospital", label: "Hospital", icon: Hospital },
  { key: "polyclinic", label: "Polyclinic", icon: Stethoscope },
];

const DEFAULT_FORM = {
  budget_min: 300000,
  budget_max: 800000,
  preferred_towns: [],
  important_places: [],
  num_bedrooms: 3,
  property_type: "any",
  mrt_enabled: false, mrt_minutes: 10,
  bus_enabled: false, bus_minutes: 5,
  parks_enabled: false, parks_minutes: 10, parks_mode: "walk",
  schools_enabled: false, schools_minutes: 10, schools_mode: "walk",
  hawker_enabled: false, hawker_minutes: 10, hawker_mode: "walk",
  supermarket_enabled: false, supermarket_minutes: 10, supermarket_mode: "walk",
  hospital_enabled: false, hospital_minutes: 15, hospital_mode: "commute",
  polyclinic_enabled: false, polyclinic_minutes: 15, polyclinic_mode: "commute",
};

function PreferenceRow({ icon: Icon, label, enabledKey, minutesKey, modeKey, walkOnly, form, setForm }) {
  const enabled = form[enabledKey];

  return (
    <div className={`rounded-xl border transition-all ${enabled ? "border-orange-200 bg-orange-50/40" : "border-slate-100 bg-white"}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? "bg-orange-100" : "bg-slate-100"}`}>
            <Icon className={`w-4 h-4 ${enabled ? "text-orange-600" : "text-slate-400"}`} />
          </div>
          <span className={`text-sm font-medium ${enabled ? "text-slate-800" : "text-slate-500"}`}>{label}</span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setForm({ ...form, [enabledKey]: v })}
        />
      </div>

      {enabled && (
        <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Within</span>
          <Input
            type="number"
            min={1}
            max={120}
            value={form[minutesKey]}
            onChange={(e) => setForm({ ...form, [minutesKey]: Number(e.target.value) })}
            className="w-16 h-8 text-sm text-center"
          />
          <span className="text-xs text-slate-500">min</span>
          {walkOnly ? (
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">walk</span>
          ) : (
            <Select value={form[modeKey]} onValueChange={(v) => setForm({ ...form, [modeKey]: v })}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk">🚶 walk</SelectItem>
                <SelectItem value="commute">🚌 commute</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}

export default function LifestyleProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [computing, setComputing] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    const load = async () => {
      const me = await api.auth.me();
      setUser(me);
      const profiles = await api.entities.LifestyleProfile.filter({ user_id: me.id });
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        setForm({ ...DEFAULT_FORM, ...profiles[0] });
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, user_id: user.id };
    if (profile) {
      await api.entities.LifestyleProfile.update(profile.id, data);
    } else {
      const created = await api.entities.LifestyleProfile.create(data);
      setProfile(created);
    }
    setSaving(false);
    setSaved(true);
    toast.success("Lifestyle profile saved!");
    setTimeout(() => setSaved(false), 2000);

    // Trigger LifeScore computation in background
    setComputing(true);
    toast.info("Computing your LifeScores... this may take a moment ⚡");
    fetch('/api/compute-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, profile: data })
    }).then(r => r.json()).then(result => {
      setComputing(false);
      toast.success(`LifeScores ready! ${result.computed} properties scored 🎯`);
    }).catch(err => {
      setComputing(false);
      console.error('Score computation failed:', err);
    });
  };

  const formatCurrency = (val) => `$${Number(val).toLocaleString()}`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Lifestyle Profile</h1>
        <p className="text-slate-500 mt-1">Set your filters and preferences to get better property matches.</p>
      </div>

      {/* Hard Filters */}
      <Card className="mb-6 border-slate-100">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Hard Filters</CardTitle>
          <p className="text-sm text-slate-500">These filters strictly narrow down your property pool.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">Min Budget (SGD)</Label>
              <Input
                type="number"
                value={form.budget_min}
                onChange={(e) => setForm({ ...form, budget_min: Number(e.target.value) })}
              />
              <span className="text-xs text-slate-400 mt-1">{formatCurrency(form.budget_min)}</span>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Max Budget (SGD)</Label>
              <Input
                type="number"
                value={form.budget_max}
                onChange={(e) => setForm({ ...form, budget_max: Number(e.target.value) })}
              />
              <span className="text-xs text-slate-400 mt-1">{formatCurrency(form.budget_max)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">Bedrooms</Label>
              <Select value={String(form.num_bedrooms)} onValueChange={(v) => setForm({ ...form, num_bedrooms: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} Bedroom{n > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Property Type</Label>
              <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="hdb">HDB</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="landed">Landed</SelectItem>
                  <SelectItem value="executive_condo">Executive Condo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferred Towns */}
      <Card className="mb-4 border-slate-100">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Where do you want to live?</CardTitle>
              <p className="text-sm text-slate-500 mt-0.5">Add up to 5 towns — rank by priority.</p>
            </div>
            <div className="w-12 h-12 rounded-xl border-2 border-orange-200 bg-orange-50 flex items-center justify-center">
              <span className="text-orange-700 font-bold text-sm">{form.preferred_towns.length}<span className="text-orange-400 font-normal">/5</span></span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TownRanker
            towns={form.preferred_towns || []}
            onChange={(towns) => setForm({ ...form, preferred_towns: towns })}
          />
        </CardContent>
      </Card>

      {/* Important Places */}
      <Card className="mb-4 border-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Important Places</CardTitle>
          <p className="text-sm text-slate-500">Add up to 5 locations that matter to you (e.g. child's school, parents' house).</p>
        </CardHeader>
        <CardContent>
          <ImportantPlaces
            places={form.important_places || []}
            onChange={(places) => setForm({ ...form, important_places: places })}
          />
        </CardContent>
      </Card>

      {/* Transport - Walk Only */}
      <Card className="mb-4 border-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transport Accessibility</CardTitle>
          <p className="text-sm text-slate-500">Toggle on and set how far you're willing to walk.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {WALK_ONLY.map((item) => (
            <PreferenceRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              enabledKey={`${item.key}_enabled`}
              minutesKey={`${item.key}_minutes`}
              modeKey={null}
              walkOnly={true}
              form={form}
              setForm={setForm}
            />
          ))}
        </CardContent>
      </Card>

      {/* Amenities - Walk or Commute */}
      <Card className="mb-6 border-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nearby Amenities</CardTitle>
          <p className="text-sm text-slate-500">Toggle what matters to you and set your max travel time.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {AMENITIES.map((item) => (
            <PreferenceRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              enabledKey={`${item.key}_enabled`}
              minutesKey={`${item.key}_minutes`}
              modeKey={`${item.key}_mode`}
              walkOnly={false}
              form={form}
              setForm={setForm}
            />
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving || computing}
        className="w-full h-12 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold"
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
        ) : computing ? (
          <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Computing LifeScores...</>
        ) : saved ? (
          <><Check className="w-4 h-4 mr-2" /> Saved!</>
        ) : (
          <><Save className="w-4 h-4 mr-2" /> Save Profile</>
        )}
      </Button>
    </div>
  );
}
