# Homie

Property matching platform for Singapore. Buyers discover HDB listings scored against their lifestyle preferences. Agents manage listings and communicate with matched buyers via real-time chat.

Built for NTU SC2006 Software Engineering.

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Backend | Express.js on Node.js v18, port 3001 |
| Database | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| Geocoding | OneMap API (Singapore) |
| Amenity resolution | Overpass / OpenStreetMap API |
| AI Wingman | Groq — meta-llama/llama-4-scout-17b-16e-instruct |

---

## Prerequisites

- Node.js v18 or later
- A Supabase project with schema and amenity tables seeded
- OneMap account (register free at onemap.gov.sg)
- Groq API key (console.groq.com)

---

## Environment variables

Create a `.env` file in the project root:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ONEMAP_EMAIL=
ONEMAP_PASSWORD=
GROQ_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is required for backend operations (score computation, amenity writes). If omitted, the backend falls back to the anon key and row-level security will block most writes.

---

## Installation

```
npm install
```

---

## Running locally

Start frontend and backend together:

```
npx concurrently "vite" "node server.js"
```

Or separately:

```
# Frontend — http://localhost:5173
npm run dev

# Backend — http://localhost:3001
node server.js
```

---

## First-time data setup

After starting the backend, run these once in order:

```
# 1. Seed HDB listings from CSV
curl -X POST http://localhost:3001/api/seed

# 2. Geocode all listings and precompute amenity distances
curl -X POST http://localhost:3001/api/precompute-amenities
```

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/seed | Seed listings from hdb_seed_final.csv |
| POST | /api/precompute-amenities | Geocode and precompute amenity distances for all listings |
| POST | /api/precompute-single-listing | Geocode and precompute amenity distances for one listing |
| POST | /api/precompute-custom-amenities | Resolve custom amenity searches via Overpass API |
| POST | /api/compute-scores | Compute LifeScores for all listings for a given buyer |
| POST | /api/wingman | Proxy a prompt to the Groq AI model |
| GET | /api/onemap-token | Return the current OneMap bearer token to the frontend |
| GET | /api/nearest-bus-stop | Find the nearest bus stop via Overpass API |

---

## Project structure

```
src/
  api/           Supabase client, auth, and entity CRUD wrappers
  components/    Shared UI components
  pages/         Page-level React components
  lib/           Auth context and utility functions
server.js        Express backend (all API routes)
hdb_seed_final.csv  Source HDB listing data
```

---

## Notes

- OneMap tokens expire every 3 days. The server refreshes them automatically using the credentials in `.env`.
- LifeScore computation is pure Haversine math with no external API calls. It runs entirely on the backend against precomputed amenity distances.
- Never commit `.env`. It contains live service credentials.
