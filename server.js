// server.js — Homie backend (Scalable Architecture v2)
//
// ARCHITECTURE:
// Phase 1: /api/precompute-amenities — geocode listings + find nearest amenities from local DB tables
// Phase 2: /api/compute-scores — pure Haversine math, zero API calls, instant
//
// Amenity data stored in Supabase: amenity_mrt, amenity_hawker, amenity_supermarket,
// amenity_hospital, amenity_polyclinic, amenity_park

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// ─── Haversine distance (metres) ─────────────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Convert distance to minutes ─────────────────────────────────────────────
// Input is straight-line (Haversine) distance. Apply detour factors for Singapore:
//   Walk:    ×1.6 detour (HDB blocks, overhead bridges, underpasses) → 5 km/h = 83 m/min
//   Drive:   ×1.4 detour → ~22 km/h effective in SG urban traffic
//   Commute: ×1.6 detour → ~12 km/h effective (includes walk-to-station + waiting)
function distanceToMinutes(metres, mode = 'walk') {
  if (mode === 'walk')   return (metres * 1.6) / 83;
  if (mode === 'drive')  return (metres * 1.4) / 367;
  return (metres * 1.6) / 200; // commute / transit
}

// ─── OneMap token auto-refresh ────────────────────────────────────────────────
let oneMapToken = process.env.ONEMAP_TOKEN || null;
let tokenExpiresAt = 0;
let refreshPromise = null; // prevent race condition

async function getOneMapToken() {
  // Already valid — return immediately
  if (oneMapToken && Date.now() < tokenExpiresAt - 10 * 60 * 1000) {
    return oneMapToken;
  }
  // If already refreshing, wait for that to finish
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      console.log('🔄 Refreshing OneMap token...');
      const res = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: process.env.ONEMAP_EMAIL,
          password: process.env.ONEMAP_PASSWORD
        })
      });
      const data = await res.json();
      if (data.access_token) {
        oneMapToken = data.access_token;
        tokenExpiresAt = (data.expiry_timestamp || (Date.now() / 1000 + 259200)) * 1000;
        console.log('✅ OneMap token refreshed, expires:', new Date(tokenExpiresAt).toISOString());
      } else {
        console.error('❌ OneMap token refresh failed:', data);
      }
    } catch (err) {
      console.error('❌ OneMap token refresh error:', err.message);
    } finally {
      refreshPromise = null;
    }
    return oneMapToken;
  })();

  return refreshPromise;
}

// Warm up token on server start
getOneMapToken();

// Auto-refresh every 2.5 days
setInterval(getOneMapToken, 2.5 * 24 * 60 * 60 * 1000);

// ─── OneMap: geocode address → { lat, lng } ───────────────────────────────────
function expandAddress(address) {
  return address
    .replace(/\bNTH\b/g, 'NORTH')
    .replace(/\bSTH\b/g, 'SOUTH')
    .replace(/\bAVE\b/g, 'AVENUE')
    .replace(/\bST\b/g, 'STREET')
    .replace(/\bRD\b/g, 'ROAD')
    .replace(/\bDR\b/g, 'DRIVE')
    .replace(/\bCRES\b/g, 'CRESCENT')
    .replace(/\bCTRL\b/g, 'CENTRAL')
    .replace(/\bCTR\b/g, 'CENTRAL')
    .replace(/\bTER\b/g, 'TERRACE')
    .replace(/\bPL\b/g, 'PLACE')
    .replace(/\bCL\b/g, 'CLOSE')
    .replace(/\bBLVD\b/g, 'BOULEVARD')
    .replace(/\bUPP\b/g, 'UPPER')
    .replace(/\bLWR\b/g, 'LOWER')
    .replace(/\bBT\b/g, 'BUKIT')
    .replace(/\bMKT\b/g, 'MARKET');
}

async function geocodeAddress(address, block, town) {
  const token = await getOneMapToken();

  // Try multiple search formats in order of precision
  const queries = [];
  if (block && town) {
    queries.push(`${block} ${town}`);           // e.g. "439 ANG MO KIO"
    queries.push(`BLK ${block} ${town}`);       // e.g. "BLK 439 ANG MO KIO"
  }
  queries.push(address);                         // original address as fallback

  for (const query of queries) {
    try {
      const encoded = encodeURIComponent(query);
      const headers = token ? { 'Authorization': token } : {};
      const res = await fetch(
        `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encoded}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,
        { headers }
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const r = data.results[0];
        return {
          lat: parseFloat(r.LATITUDE),
          lng: parseFloat(r.LONGITUDE),
          postal: r.POSTAL || null,
          address: r.ADDRESS || address
        };
      }
    } catch (err) {
      console.log(`⚠️ Geocode error for: ${query} | ${err.message}`);
    }
  }

  console.log(`⚠️ No geocode result for: ${address}`);
  return null;
}

// ─── Find nearest amenity from local Supabase table ──────────────────────────
async function findNearestFromTable(tableName, lat, lng) {
  try {
    const { data, error } = await supabase.from(tableName).select('name, lat, lng');
    if (error || !data || data.length === 0) return null;

    let nearest = null;
    let minDist = Infinity;
    for (const row of data) {
      const dist = haversineDistance(lat, lng, row.lat, row.lng);
      if (dist < minDist) {
        minDist = dist;
        nearest = { name: row.name, lat: row.lat, lng: row.lng, distance_m: dist };
      }
    }
    return nearest;
  } catch {
    return null;
  }
}

// ─── Compute LifeScore from pre-saved amenity data (pure math, no API) ───────
function computeScoreFromAmenities(amenities, profile, listingCoords) {
  const breakdown = {};
  let totalCriteria = 0;
  let totalPoints = 0;

  const AMENITY_MAP = [
    { key: 'mrt',         distKey: 'mrt_distance_m',         nameKey: 'mrt_name',         label: 'MRT Station',   mode: 'walk' },
    { key: 'bus',         distKey: 'bus_distance_m',         nameKey: null,               label: 'Bus Stop',      mode: 'walk' },
    { key: 'hawker',      distKey: 'hawker_distance_m',      nameKey: 'hawker_name',      label: 'Hawker Centre', mode: profile.hawker_mode || 'walk' },
    { key: 'supermarket', distKey: 'supermarket_distance_m', nameKey: 'supermarket_name', label: 'Supermarket',   mode: profile.supermarket_mode || 'walk' },
    { key: 'parks',       distKey: 'parks_distance_m',       nameKey: 'parks_name',       label: 'Parks',         mode: profile.parks_mode || 'walk' },
    { key: 'hospital',    distKey: 'hospital_distance_m',    nameKey: 'hospital_name',    label: 'Hospital',      mode: profile.hospital_mode || 'commute' },
    { key: 'polyclinic',  distKey: 'polyclinic_distance_m',  nameKey: 'polyclinic_name',  label: 'Polyclinic',    mode: profile.polyclinic_mode || 'commute' },
  ];

  // ── Budget match (2x weight) ──────────────────────────────────────────────
  if (profile.budget_max && amenities.price) {
    const weight = 2;
    totalCriteria += weight;
    const price = amenities.price;
    const min = profile.budget_min ?? 0;
    const max = profile.budget_max;
    const overBy = price - max;
    const underBy = min - price;
    if (price >= min && price <= max) {
      totalPoints += weight;
      breakdown.budget = { label: 'Budget', status: 'full', points: weight };
    } else if (overBy > 0 && overBy / max <= 0.1) {
      // within 10% over budget — partial
      totalPoints += weight * 0.5;
      breakdown.budget = { label: 'Budget', status: 'partial', points: weight * 0.5 };
    } else if (underBy > 0 && underBy / min <= 0.1) {
      // within 10% under min — partial
      totalPoints += weight * 0.5;
      breakdown.budget = { label: 'Budget', status: 'partial', points: weight * 0.5 };
    } else {
      breakdown.budget = { label: 'Budget', status: 'none', points: 0 };
    }
  }

  // ── Location match (2x weight) ────────────────────────────────────────────
  if (profile.preferred_towns?.length > 0 && amenities.town) {
    const weight = 2;
    totalCriteria += weight;
    if (profile.preferred_towns.includes(amenities.town)) {
      totalPoints += weight;
      breakdown.location = { label: 'Location', status: 'full', points: weight };
    } else {
      breakdown.location = { label: 'Location', status: 'none', points: 0 };
    }
  }

  // Bedroom match
  if (profile.num_bedrooms) {
    totalCriteria++;
    const diff = Math.abs((amenities.num_bedrooms || 3) - profile.num_bedrooms);
    if (diff === 0) { totalPoints += 1; breakdown.bedrooms = { label: 'Bedrooms', status: 'full', points: 1 }; }
    else if (diff === 1) { totalPoints += 0.5; breakdown.bedrooms = { label: 'Bedrooms', status: 'partial', points: 0.5 }; }
    else { breakdown.bedrooms = { label: 'Bedrooms', status: 'none', points: 0 }; }
  }

  // Amenity checks
  for (const amenity of AMENITY_MAP) {
    if (!profile[`${amenity.key}_enabled`]) continue;

    const distanceM = amenities[amenity.distKey];
    const name = amenity.nameKey ? amenities[amenity.nameKey] : amenity.label;
    const threshold = profile[`${amenity.key}_minutes`] || 10;
    const buffer = amenity.mode === 'walk' ? 3 : 5;

    if (distanceM == null) {
      breakdown[amenity.key] = { label: amenity.label, status: 'none', points: 0, minutes: null };
      continue; // skip — no data, don't penalise
    }

    totalCriteria++;

    const minutes = distanceToMinutes(distanceM, amenity.mode);
    if (minutes <= threshold) {
      totalPoints += 1;
      breakdown[amenity.key] = { label: amenity.label, status: 'full', points: 1, minutes: Math.round(minutes), name };
    } else if (minutes <= threshold + buffer) {
      totalPoints += 0.5;
      breakdown[amenity.key] = { label: amenity.label, status: 'partial', points: 0.5, minutes: Math.round(minutes), name };
    } else {
      breakdown[amenity.key] = { label: amenity.label, status: 'none', points: 0, minutes: Math.round(minutes), name };
    }
  }

  // Custom amenities
  const customAmenityData = amenities.customAmenities || {};
  for (const custom of (profile.custom_amenities || [])) {
    if (!customAmenityData[custom.query]) continue;
    totalCriteria++;
    const { distance_m, name } = customAmenityData[custom.query];
    const threshold = custom.minutes || 10;
    const mode = custom.mode || 'walk';
    const buffer = mode === 'walk' ? 3 : 5;
    const minutes = distanceToMinutes(distance_m, mode);

    if (minutes <= threshold) {
      totalPoints += 1;
      breakdown[`custom_${custom.query}`] = { label: custom.label, status: 'full', points: 1, minutes: Math.round(minutes), name };
    } else if (minutes <= threshold + buffer) {
      totalPoints += 0.5;
      breakdown[`custom_${custom.query}`] = { label: custom.label, status: 'partial', points: 0.5, minutes: Math.round(minutes), name };
    } else {
      breakdown[`custom_${custom.query}`] = { label: custom.label, status: 'none', points: 0, minutes: Math.round(minutes), name };
    }
  }

  // Important places
  for (const place of (profile.important_places || [])) {
    if (!place.lat || !place.lng || !listingCoords) continue;
    totalCriteria++;
    const distanceM = haversineDistance(listingCoords.lat, listingCoords.lng, place.lat, place.lng);
    const threshold = place.minutes || 20;
    const mode = place.mode || 'commute';
    const buffer = mode === 'walk' ? 3 : 5;
    const travelMins = distanceToMinutes(distanceM, mode);
    const key = `place_${place.label}`;

    if (travelMins <= threshold) {
      totalPoints += 1;
      breakdown[key] = { label: place.label, status: 'full', points: 1, minutes: Math.round(travelMins), mode };
    } else if (travelMins <= threshold + buffer) {
      totalPoints += 0.5;
      breakdown[key] = { label: place.label, status: 'partial', points: 0.5, minutes: Math.round(travelMins), mode };
    } else {
      breakdown[key] = { label: place.label, status: 'none', points: 0, minutes: Math.round(travelMins), mode };
    }
  }

  const score = totalCriteria > 0 ? Math.round((totalPoints / totalCriteria) * 100) : 50;
  return { score, breakdown };
}

// ─── POST /api/precompute-amenities ──────────────────────────────────────────
// Run once after seeding. Geocodes listings + finds nearest amenities from local tables.
app.post('/api/precompute-amenities', async (req, res) => {
  try {
    const { data: listings, error } = await supabase
      .from('listings').select('*').eq('status', 'active');

    if (error) throw error;
    if (!listings || listings.length === 0)
      return res.json({ message: 'All listings already processed!', processed: 0 });

    console.log(`Pre-computing amenities for ${listings.length} listings...`);

    // Ensure token is ready before starting
    await getOneMapToken();

    const BATCH_SIZE = 10;
    let processed = 0;
    const amenityRows = [];

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(batch.map(async (listing) => {
        const coords = await geocodeAddress(listing.address, listing.block, listing.town);
        if (!coords) return null;

        // Query local amenity tables in parallel
        const [mrt, hawker, supermarket, hospital, polyclinic, park] = await Promise.all([
          findNearestFromTable('amenity_mrt', coords.lat, coords.lng),
          findNearestFromTable('amenity_hawker', coords.lat, coords.lng),
          findNearestFromTable('amenity_supermarket', coords.lat, coords.lng),
          findNearestFromTable('amenity_hospital', coords.lat, coords.lng),
          findNearestFromTable('amenity_polyclinic', coords.lat, coords.lng),
          findNearestFromTable('amenity_park', coords.lat, coords.lng),
        ]);

        // Bus stop: estimate as 200m average (bus stops are ~200m apart in SG)
        const bus_distance_m = 200;

        await supabase.from('listings').update({ lat: coords.lat, lng: coords.lng }).eq('id', listing.id);

        return {
          listing_id: listing.id,
          mrt_distance_m: mrt?.distance_m ?? null, mrt_name: mrt?.name ?? null,
          bus_distance_m,
          hawker_distance_m: hawker?.distance_m ?? null, hawker_name: hawker?.name ?? null,
          supermarket_distance_m: supermarket?.distance_m ?? null, supermarket_name: supermarket?.name ?? null,
          parks_distance_m: park?.distance_m ?? null, parks_name: park?.name ?? null,
          hospital_distance_m: hospital?.distance_m ?? null, hospital_name: hospital?.name ?? null,
          polyclinic_distance_m: polyclinic?.distance_m ?? null, polyclinic_name: polyclinic?.name ?? null,
        };
      }));

      const valid = results.filter(Boolean);
      amenityRows.push(...valid);
      processed += batch.length;
      console.log(`Progress: ${processed}/${listings.length}`);
    }

    if (amenityRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('listing_amenities').upsert(amenityRows, { onConflict: 'listing_id' });
      if (upsertError) throw upsertError;
    }

    res.json({ processed: amenityRows.length, message: 'Amenities pre-computed!' });
  } catch (err) {
    console.error('Precompute error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/precompute-single-listing ─────────────────────────────────────
// Called when agent adds a new listing
app.post('/api/precompute-single-listing', async (req, res) => {
  const { listing_id, listingId: listingIdAlt } = req.body;
  const listingId = listing_id || listingIdAlt;
  if (!listingId) return res.status(400).json({ error: 'Missing listing_id' });

  try {
    const { data: listing } = await supabase.from('listings').select('*').eq('id', listingId).single();
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const coords = await geocodeAddress(listing.address);
    if (!coords) return res.status(500).json({ error: 'Could not geocode address' });

    const [mrt, hawker, supermarket, hospital, polyclinic, park] = await Promise.all([
      findNearestFromTable('amenity_mrt', coords.lat, coords.lng),
      findNearestFromTable('amenity_hawker', coords.lat, coords.lng),
      findNearestFromTable('amenity_supermarket', coords.lat, coords.lng),
      findNearestFromTable('amenity_hospital', coords.lat, coords.lng),
      findNearestFromTable('amenity_polyclinic', coords.lat, coords.lng),
      findNearestFromTable('amenity_park', coords.lat, coords.lng),
    ]);

    const { error: updateErr } = await supabase.from('listings').update({ lat: coords.lat, lng: coords.lng, geocoded: true }).eq('id', listingId);
    if (updateErr) console.error('❌ Failed to save lat/lng:', updateErr);
    else console.log('✅ Geocoded:', coords.lat, coords.lng);

    const { error } = await supabase.from('listing_amenities').upsert({
      listing_id: listingId,
      mrt_distance_m: mrt?.distance_m ?? null, mrt_name: mrt?.name ?? null,
      bus_distance_m: 200,
      hawker_distance_m: hawker?.distance_m ?? null, hawker_name: hawker?.name ?? null,
      supermarket_distance_m: supermarket?.distance_m ?? null, supermarket_name: supermarket?.name ?? null,
      parks_distance_m: park?.distance_m ?? null, parks_name: park?.name ?? null,
      hospital_distance_m: hospital?.distance_m ?? null, hospital_name: hospital?.name ?? null,
      polyclinic_distance_m: polyclinic?.distance_m ?? null, polyclinic_name: polyclinic?.name ?? null,
    }, { onConflict: 'listing_id' });

    if (error) throw error;

    // Compute scores for all existing buyer profiles for this new listing
    const { data: profiles } = await supabase.from('lifestyle_profiles').select('*');
    const { data: amenityRow } = await supabase.from('listing_amenities').select('*').eq('listing_id', listingId).single();
    const listingCoords = coords;
    for (const profile of (profiles || [])) {
      const amenities = { ...amenityRow, num_bedrooms: listing.num_bedrooms, town: listing.town, price: listing.price };
      const { score, breakdown } = computeScoreFromAmenities(amenities, profile, listingCoords);
      await supabase.from('lifestyle_scores').upsert(
        { user_id: profile.user_id, listing_id: listingId, score, score_breakdown: breakdown },
        { onConflict: 'user_id,listing_id' }
      );
    }

    res.json({ success: true, message: 'Listing amenities computed and scores updated!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/precompute-custom-amenities ────────────────────────────────────
app.post('/api/precompute-custom-amenities', async (req, res) => {
  const { userId, customAmenities } = req.body;
  if (!userId || !customAmenities?.length) 
    return res.json({ message: 'No custom amenities to process', processed: 0 });

  try {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, lat, lng')
      .eq('status', 'active')
      .not('lat', 'is', null);

    const rows = [];

    for (const custom of customAmenities) {
      let results = [];
      try {
        // Use Overpass API to search by name/amenity across Singapore
        // Singapore bounding box: 1.1,103.6,1.5,104.1
        
        // Map common search terms to OSM tags
        const OSM_TAG_MAP = {
          'gym': 'leisure=fitness_centre',
          'fitness': 'leisure=fitness_centre',
          'yoga': 'sport=yoga',
          'yoga studio': 'sport=yoga',
          'swimming pool': 'leisure=swimming_pool',
          'pool': 'leisure=swimming_pool',
          'park': 'leisure=park',
          'playground': 'leisure=playground',
          'pet shop': 'shop=pet',
          'pets': 'shop=pet',
          'supermarket': 'shop=supermarket',
          'grocery': 'shop=supermarket',
          'clinic': 'amenity=clinic',
          'pharmacy': 'amenity=pharmacy',
          'school': 'amenity=school',
          'library': 'amenity=library',
          'food court': 'amenity=food_court',
          'hawker': 'amenity=food_court',
          'restaurant': 'amenity=restaurant',
          'cafe': 'amenity=cafe',
          'coffee': 'amenity=cafe',
          'church': 'amenity=place_of_worship',
          'mosque': 'amenity=place_of_worship',
          'temple': 'amenity=place_of_worship',
          'childcare': 'amenity=childcare',
          'kindergarten': 'amenity=kindergarten',
          'community centre': 'amenity=community_centre',
          'cc': 'amenity=community_centre',
        };

        const queryLower = custom.query.toLowerCase();
        const osmTag = OSM_TAG_MAP[queryLower];

        let overpassQuery;
        if (osmTag) {
          const [key, value] = osmTag.split('=');
          overpassQuery = `
            [out:json][timeout:25];
            (
              node["${key}"="${value}"](1.1,103.6,1.5,104.1);
              way["${key}"="${value}"](1.1,103.6,1.5,104.1);
            );
            out center;
          `;
        } else {
          // Fall back to name search for unrecognised terms
          overpassQuery = `
            [out:json][timeout:25];
            (
              node["name"~"${custom.query}",i](1.1,103.6,1.5,104.1);
              way["name"~"${custom.query}",i](1.1,103.6,1.5,104.1);
            );
            out center;
          `;
        }

        const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(overpassQuery.trim())}`,
        });
        const data = await overpassRes.json();
        results = (data.elements || []).map(r => ({
          ...r,
          lat: r.lat ?? r.center?.lat,
          lon: r.lon ?? r.center?.lon,
          tags: r.tags || {},
        })).filter(r => r.lat && r.lon);
        console.log(`Overpass results for "${custom.query}":`, results.length);
      } catch (err) {
        console.log(`Overpass error for ${custom.query}:`, err.message);
        continue;
      }

      if (results.length === 0) {
        console.log(`No Overpass results for: ${custom.query}`);
        continue;
      }

      // For each listing, find nearest result from the search
      for (const listing of listings) {
        let nearest = null;
        let minDist = Infinity;

        for (const r of results) {
          const dist = haversineDistance(
            listing.lat, listing.lng,
            r.lat, r.lon
          );
          if (dist < minDist) {
            minDist = dist;
            nearest = { 
              name: r.tags?.name || r.tags?.['name:en'] || r.tags?.operator || custom.query, 
              distance_m: dist 
            };
          }
        }

        if (nearest) {
          rows.push({
            user_id: userId,
            listing_id: listing.id,
            query: custom.query,
            name: nearest.name,
            distance_m: nearest.distance_m,
          });
        }
      }
    }

    console.log('Rows to upsert:', rows.length);
    if (rows.length > 0) {
      const { error } = await supabase
        .from('custom_amenity_scores')
        .upsert(rows, { onConflict: 'user_id,listing_id,query' });
      if (error) {
        console.log('Upsert error:', error);
        throw error;
      } else {
        console.log('Upsert success!');
      }
    }

    // Clean up old queries no longer in profile
    const activeQueries = customAmenities.map(a => a.query);
    const { data: existingRows } = await supabase
      .from('custom_amenity_scores')
      .select('query')
      .eq('user_id', userId);

    const queriesToDelete = [...new Set((existingRows || []).map(r => r.query))]
      .filter(q => !activeQueries.includes(q));

    if (queriesToDelete.length > 0) {
      for (const q of queriesToDelete) {
        await supabase
          .from('custom_amenity_scores')
          .delete()
          .eq('user_id', userId)
          .eq('query', q);
      }
      console.log('Cleaned up old queries:', queriesToDelete);
    }

    res.json({ processed: rows.length, message: 'Custom amenities precomputed!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/compute-scores ─────────────────────────────────────────────────
// Pure math — no API calls. Instant regardless of user count.
app.post('/api/compute-scores', async (req, res) => {
  const { userId, profile } = req.body;
  if (!userId || !profile) return res.status(400).json({ error: 'Missing userId or profile' });

  try {
    const { data: listings, error } = await supabase
      .from('listings').select('*').eq('status', 'active');
    if (error) throw error;

    const { data: amenityRows } = await supabase.from('listing_amenities').select('*');
    const amenityMap = {};
    (amenityRows || []).forEach(a => { amenityMap[a.listing_id] = a; });

    // Load custom amenity scores for this user
    const { data: customRows } = await supabase
    .from('custom_amenity_scores')
    .select('*')
    .eq('user_id', userId);

    const customAmenityMap = {}; // { listing_id: { query: { name, distance_m } } }
    for (const row of (customRows || [])) {
      if (!customAmenityMap[row.listing_id]) customAmenityMap[row.listing_id] = {};
      customAmenityMap[row.listing_id][row.query] = { name: row.name, distance_m: row.distance_m };
    }

    // Geocode any important places that have postal_code but no lat/lng (legacy entries)
    const places = profile.important_places || [];
    let geocodedAny = false;
    for (const place of places) {
      if (place.lat && place.lng) continue;
      if (!place.postal_code) continue;
      const coords = await geocodeAddress(place.postal_code);
      if (coords) { place.lat = coords.lat; place.lng = coords.lng; geocodedAny = true; }
    }
    if (geocodedAny) {
      // Persist geocoded coords back so future runs are instant
      await supabase.from('lifestyle_profiles')
        .update({ important_places: places })
        .eq('user_id', userId);
    }

    await supabase.from('lifestyle_scores').delete().eq('user_id', userId);

    const scores = listings.map(listing => {
      const amenities = amenityMap[listing.id] || {};
      const customAmenities = customAmenityMap[listing.id] || {};
      const listingCoords = listing.lat && listing.lng ? { lat: listing.lat, lng: listing.lng } : null;
      const { score, breakdown } = computeScoreFromAmenities(
        { ...amenities, num_bedrooms: listing.num_bedrooms, town: listing.town, price: listing.price, customAmenities }, profile, listingCoords
      );
      return { user_id: userId, listing_id: listing.id, score, score_breakdown: breakdown, computed_at: new Date().toISOString() };
    });

    const { error: insertError } = await supabase
      .from('lifestyle_scores').upsert(scores, { onConflict: 'user_id,listing_id' });
    if (insertError) throw insertError;

    // Auto-update compatibility_score in matches table
    for (const s of scores) {
      if (s.score !== undefined) {
        await supabase.from('matches')
          .update({ compatibility_score: s.score })
          .eq('buyer_id', userId)
          .eq('listing_id', s.listing_id);
      }
    }

    console.log(`Computed ${scores.length} scores instantly for user ${userId}`);
    res.json({ computed: scores.length, message: 'Scores computed!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/wingman ────────────────────────────────────────────────────────
app.post('/api/wingman', async (req, res) => {
  try {
    const { prompt, messages } = req.body;
    let fullPrompt = `You are Homie's AI Wingman — a friendly, concise property advisor for Singapore.
Give honest, practical advice about HDB, BTO, resale, condo, CPF, ABSD, grants, and lifestyle trade-offs.
Keep answers to 3-5 sentences max. Be warm and direct.\n\n`;
    if (messages) fullPrompt += messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    else fullPrompt += `User: ${prompt}`;

    const r = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: 'meta-llama/llama-4-scout-17b-16e-instruct', messages: [{ role: 'user', content: fullPrompt }], max_tokens: 500 }) }
    );
    const data = await r.json();
    res.json({ reply: data.choices?.[0]?.message?.content || 'Sorry, could not generate a response.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/seed ───────────────────────────────────────────────────────────
app.post('/api/seed', async (req, res) => {
  try {
    const csvPath = join(__dirname, 'hdb_seed_final.csv');
    const csvText = readFileSync(csvPath, 'utf8');
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');

        const REGION_MAP = {
          'Ang Mo Kio': 'North-East', 'Bedok': 'East', 'Bishan': 'Central',
          'Bukit Batok': 'West', 'Bukit Merah': 'Central', 'Bukit Panjang': 'West',
          'Bukit Timah': 'Central', 'Choa Chu Kang': 'West', 'Clementi': 'West',
          'Geylang': 'Central', 'Hougang': 'North-East', 'Jurong East': 'West',
          'Jurong West': 'West', 'Kallang': 'Central', 'Marine Parade': 'East',
          'Pasir Ris': 'East', 'Punggol': 'North-East', 'Queenstown': 'Central',
          'Sembawang': 'North', 'Sengkang': 'North-East', 'Serangoon': 'North-East',
          'Tampines': 'East', 'Toa Payoh': 'Central', 'Woodlands': 'North', 'Yishun': 'North',
        };

        const FLAT_TYPE_MAP = {
          '1R': 1, '2R': 2, '2S': 2, '2I': 2,
          '3NG': 3, '3A': 3, '3S': 3, '3I': 3, '3STD': 3,
          '4NG': 4, '4A': 4, '4S': 4, '4I': 4, '4PA': 4, '4STD': 4,
          '5I': 5, '5S': 5, '5A': 5, '5PA': 5,
          'EA': 5, 'EM': 5, '3PA': 3,
        };

    const listings = lines.slice(1).map(line => {
          const vals = line.split(',');
          const r = {};
          headers.forEach((h, i) => r[h.trim()] = (vals[i] || '').trim().replace(/\r/g, ''));

          return {
            title: `${r.flat_type} at Blk ${r.block} ${r.town}`,
            town: r.town,
            region: REGION_MAP[r.town] || 'Central',
            flat_type: r.flat_type,
            listing_type: 'sale',
            price: parseInt(r.price),
            block: r.block,
            address: r.full_address || `Blk ${r.block} ${r.town}`,
            postal_code: r.postal || null,
            floor_area_sqm: parseFloat(r.size_sqm),
            storey_range: r.floor_range,
            lease_remaining: parseInt(r.lease_remaining),
            num_bedrooms: FLAT_TYPE_MAP[r.flat_type] || 3,
            property_type: 'hdb',
            status: 'active',
            location_area: r.town,
            lat: r.lat ? parseFloat(r.lat) : null,
            lng: r.lng ? parseFloat(r.lng) : null,
            geocoded: !!(r.lat && r.lng),
            agent_id: null,
          };
        });

    const { error } = await supabase.from('listings').insert(listings);
    if (error) throw error;
    res.json({ seeded: listings.length, message: 'Seeded from CSV! Now run /api/precompute-amenities' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🏠 Homie API running on http://localhost:${PORT}`));
