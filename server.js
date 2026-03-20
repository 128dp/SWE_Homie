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
  process.env.VITE_SUPABASE_ANON_KEY
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
function distanceToMinutes(metres, mode = 'walk') {
  return mode === 'walk' ? metres / 80 : metres / 300;
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
      const res = await fetch(
        `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encoded}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,
        { headers: { 'Authorization': token } }
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
    totalCriteria++;

    const distanceM = amenities[amenity.distKey];
    const name = amenity.nameKey ? amenities[amenity.nameKey] : amenity.label;
    const threshold = profile[`${amenity.key}_minutes`] || 10;
    const buffer = amenity.mode === 'walk' ? 3 : 5;

    if (distanceM == null) {
      breakdown[amenity.key] = { label: amenity.label, status: 'none', points: 0, minutes: null };
      continue;
    }

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

  // Important places
  for (const place of (profile.important_places || [])) {
    if (!place.lat || !place.lng || !listingCoords) continue;
    totalCriteria++;
    const distanceM = haversineDistance(listingCoords.lat, listingCoords.lng, place.lat, place.lng);
    const threshold = place.minutes || 20;
    const mode = place.mode || 'commute';
    const buffer = mode === 'walk' ? 3 : 5;
    const minutes = distanceToMinutes(distanceM, mode);

    if (minutes <= threshold) {
      totalPoints += 1;
      breakdown[`place_${place.name}`] = { label: place.name, status: 'full', points: 1, minutes: Math.round(minutes) };
    } else if (minutes <= threshold + buffer) {
      totalPoints += 0.5;
      breakdown[`place_${place.name}`] = { label: place.name, status: 'partial', points: 0.5, minutes: Math.round(minutes) };
    } else {
      breakdown[`place_${place.name}`] = { label: place.name, status: 'none', points: 0, minutes: Math.round(minutes) };
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
      .from('listings').select('*').eq('status', 'active').eq('geocoded', false);

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

        await supabase.from('listings').update({ lat: coords.lat, lng: coords.lng, geocoded: true }).eq('id', listing.id);

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
  const { listingId } = req.body;
  if (!listingId) return res.status(400).json({ error: 'Missing listingId' });

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

    await supabase.from('listings').update({ lat: coords.lat, lng: coords.lng, geocoded: true }).eq('id', listingId);

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
    res.json({ success: true, message: 'Listing amenities computed!' });
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
      .from('listings').select('*, listing_amenities(*)').eq('status', 'active');
    if (error) throw error;

    await supabase.from('lifestyle_scores').delete().eq('user_id', userId);

    const scores = listings.map(listing => {
      const amenities = listing.listing_amenities?.[0] || {};
      const listingCoords = listing.lat && listing.lng ? { lat: listing.lat, lng: listing.lng } : null;
      const { score, breakdown } = computeScoreFromAmenities(
        { ...amenities, num_bedrooms: listing.num_bedrooms }, profile, listingCoords
      );
      return { user_id: userId, listing_id: listing.id, score, score_breakdown: breakdown, computed_at: new Date().toISOString() };
    });

    const { error: insertError } = await supabase
      .from('lifestyle_scores').upsert(scores, { onConflict: 'user_id,listing_id' });
    if (insertError) throw insertError;

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }], generationConfig: { maxOutputTokens: 500 } }) }
    );
    const data = await r.json();
    res.json({ reply: data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, could not generate a response.' });
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
