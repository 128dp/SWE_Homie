# 🏠 Homie — Singapore Property Search App

Homie is a lifestyle-first HDB property search app for Singapore buyers. Instead of filtering by price or location alone, Homie scores listings based on how well they match your daily lifestyle — proximity to MRT, hawker centres, supermarkets, parks, hospitals, and important places.

Built with React + Vite (frontend), Express (backend), and Supabase (database + auth).

---

## Features

- **LifeScore Algorithm** — scores every listing against your lifestyle profile using real Singapore amenity data
- **Swipe to Discover** — Tinder-style card interface sorted by LifeScore
- **Wingman AI** — Groq-powered property advisor using meta-llama/llama-4-scout-17b-16e-instruct
- **Agent Dashboard** — agents can list properties; new listings are automatically geocoded and scored
- **Matches & Chat** — buyers match with listings and chat with agents
- **Property Notes** — save notes on listings you're interested in

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TailwindCSS |
| Backend | Node.js, Express |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| AI | Google Gemini 2.0 Flash |
| Geocoding | OneMap API (Singapore) |
| Amenity Data | LTA, NEA, NParks via data.gov.sg |

---

## Project Structure

```
Homie/
├── src/
│   ├── api/
│   │   └── apiClient.js         # Supabase client + auth + entity wrappers
│   ├── pages/
│   │   ├── SwipeDiscover.jsx    # Main listing discovery (LifeScore sorted)
│   │   ├── LifestyleProfile.jsx # User preferences + triggers score computation
│   │   ├── Matches.jsx          # Saved matches
│   │   ├── ChatRoom.jsx         # Buyer-agent chat
│   │   ├── BuyerDashboard.jsx   # Buyer overview
│   │   ├── AgentDashboard.jsx   # Agent listing management
│   │   └── ManageListings.jsx   # Add/edit listings
│   └── components/
│       └── PropertyCard.jsx     # Listing card with LifeScore breakdown
├── server.js                    # Express backend
├── hdb_seed_final.csv           # 100 real HDB listings with coordinates
└── .env                         # Environment variables (never commit)
```

---

## LifeScore Algorithm

Scores are pre-computed in two phases:

**Phase 1 — Precompute amenities** (run once per listing)
- Geocode listing address via OneMap
- Find nearest MRT, bus stop, hawker centre, supermarket, park, hospital, polyclinic from local Supabase amenity tables
- Save distances to `listing_amenities` table

**Phase 2 — Compute scores** (run per user profile save, zero API calls)
- Pure Haversine math against pre-saved distances
- Walk speed: 80m/min, Transit speed: 300m/min
- Full points if within threshold, half points within buffer, zero beyond
- Score = (criteria met / total criteria enabled) × 100

Amenity data sourced from LTA MRT Station Exits, NEA Hawker Centres, and NParks via data.gov.sg.

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd Homie
npm install
```

### 2. Environment variables

Create a `.env` file in the root:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
ONEMAP_EMAIL=your_onemap_email
ONEMAP_PASSWORD=your_onemap_password
```

Get credentials from:
- Supabase: [supabase.com](https://supabase.com) → Project Settings → API
- Groq API: [console.groq.com](https://console.groq.com)
- OneMap: [onemap.gov.sg](https://www.onemap.gov.sg) (register for free)

### 3. Database setup

Run these SQL files in Supabase SQL Editor in order:
1. `supabase-scores-schema.sql` — creates all tables
2. `amenity-data.sql` — loads Singapore amenity data

### 4. Run locally

Terminal 1 (frontend):
```bash
npm run dev
```

Terminal 2 (backend):
```bash
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... GEMINI_API_KEY=... ONEMAP_EMAIL=... ONEMAP_PASSWORD=... node server.js
```

### 5. Seed listings

```bash
# Seed 100 real HDB listings from CSV
curl -X POST http://localhost:3001/api/seed

# Precompute amenity distances for all listings
curl -X POST http://localhost:3001/api/precompute-amenities
```

App runs at **http://localhost:5173**

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/seed` | Seed listings from `hdb_seed_final.csv` |
| POST | `/api/precompute-amenities` | Geocode + find nearest amenities for all listings |
| POST | `/api/precompute-single-listing` | Process a single new listing (for agents) |
| POST | `/api/compute-scores` | Compute LifeScores for a user against all listings |
| POST | `/api/wingman` | AI property advisor (Gemini) |

---

## Database Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles |
| `listings` | HDB property listings |
| `lifestyle_profiles` | User lifestyle preferences |
| `lifestyle_scores` | Pre-computed LifeScores per user per listing |
| `listing_amenities` | Pre-computed nearest amenity distances per listing |
| `amenity_mrt` | MRT station locations (152 stations) |
| `amenity_hawker` | Hawker centre locations (56 centres) |
| `amenity_supermarket` | Supermarket locations (25 outlets) |
| `amenity_hospital` | Hospital locations (12 hospitals) |
| `amenity_polyclinic` | Polyclinic locations (24 polyclinics) |
| `amenity_park` | Park locations (20 parks) |
| `matches` | Buyer-listing matches |
| `swipes` | Swipe history |
| `chat_messages` | Buyer-agent chat messages |
| `property_notes` | Personal notes on listings |

---

## Notes

- OneMap tokens expire every 3 days — the server auto-refreshes using your credentials
- `.env` is gitignored — never commit credentials
- For new listings added by agents, call `/api/precompute-single-listing` with `{ listingId }` to geocode and score them immediately
