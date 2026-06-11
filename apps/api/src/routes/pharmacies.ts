import type { FastifyPluginAsync } from 'fastify'

// ── Tipos ─────────────────────────────────────────────────────────────

export interface Pharmacy {
  id: string
  name: string
  address: string
  distance: number   // metros
  lat: number
  lon: number
  phone?: string
  openingHours?: string
}

// ── Geocodificar código postal → coordenadas (Nominatim / OSM) ────────

async function geocodePostalCode(cp: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cp)}&country=es&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json() as any[]
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// ── Buscar farmacias cercanas con Overpass (OSM, gratuito) ────────────

async function findNearbyPharmacies(lat: number, lon: number, radiusM = 2000): Promise<Pharmacy[]> {
  // Overpass QL: nodos y ways con amenity=pharmacy en un radio dado
  const query = `
[out:json][timeout:12];
(
  node["amenity"="pharmacy"](around:${radiusM},${lat},${lon});
  way["amenity"="pharmacy"](around:${radiusM},${lat},${lon});
);
out center 8;
`.trim()

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Stoqly/1.0 (jtorres@cogelo.es)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(14000),
  })

  if (!res.ok) throw new Error(`Overpass error ${res.status}`)
  const data = await res.json() as any

  const pharmacies: Pharmacy[] = []

  for (const el of (data.elements ?? [])) {
    const elLat: number = el.lat ?? el.center?.lat
    const elLon: number = el.lon ?? el.center?.lon
    if (!elLat || !elLon) continue

    const tags = el.tags ?? {}
    const name = tags.name ?? tags['name:es'] ?? 'Farmacia'

    // Construir dirección desde tags de OSM
    const street  = tags['addr:street']  ?? ''
    const number  = tags['addr:housenumber'] ?? ''
    const city    = tags['addr:city'] ?? tags['addr:suburb'] ?? ''
    const address = [street, number, city].filter(Boolean).join(', ') || 'Dirección no disponible'

    // Distancia haversine
    const distance = haversine(lat, lon, elLat, elLon)

    pharmacies.push({
      id: String(el.id),
      name,
      address,
      distance: Math.round(distance),
      lat: elLat,
      lon: elLon,
      phone: tags.phone ?? tags['contact:phone'] ?? undefined,
      openingHours: tags.opening_hours ?? undefined,
    })
  }

  // Ordenar por distancia, devolver las 6 más cercanas
  return pharmacies.sort((a, b) => a.distance - b.distance).slice(0, 6)
}

// ── Fórmula haversine → distancia en metros ───────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
function toRad(deg: number) { return deg * (Math.PI / 180) }

// ── Caché simple en memoria (TTL 1h, por CP) ─────────────────────────

const cache = new Map<string, { data: Pharmacy[]; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hora

// ── Rutas ─────────────────────────────────────────────────────────────

export const pharmacyRoutes: FastifyPluginAsync = async (app) => {

  // GET /v1/pharmacies?cp=28001
  // Devuelve las farmacias más cercanas al código postal del usuario.
  // No requiere autenticación — datos públicos de OSM.
  app.get('/pharmacies', async (req, reply) => {
    const { cp } = req.query as { cp?: string }

    if (!cp || !/^\d{5}$/.test(cp)) {
      return reply.status(400).send({ error: 'Código postal inválido (5 dígitos)' })
    }

    // Caché
    const cached = cache.get(cp)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return reply.send({ data: { pharmacies: cached.data, cp, fromCache: true } })
    }

    // Geocodificar CP
    const coords = await geocodePostalCode(cp)
    if (!coords) {
      return reply.status(404).send({ error: 'No se pudo localizar el código postal' })
    }

    // Buscar farmacias
    let pharmacies: Pharmacy[] = []
    try {
      pharmacies = await findNearbyPharmacies(coords.lat, coords.lon)
    } catch (e: any) {
      app.log.warn(`Overpass error para CP ${cp}: ${e.message}`)
      // Si Overpass falla, devolvemos vacío con fallback a Google Maps
      return reply.send({
        data: { pharmacies: [], cp, coords, fallbackUrl: `https://www.google.com/maps/search/farmacia/@${coords.lat},${coords.lon},15z` }
      })
    }

    cache.set(cp, { data: pharmacies, ts: Date.now() })

    return reply.send({
      data: {
        pharmacies,
        cp,
        coords,
        // URL de fallback por si el usuario quiere ver más
        mapsUrl: `https://www.google.com/maps/search/farmacia/@${coords.lat},${coords.lon},15z`,
      }
    })
  })
}
