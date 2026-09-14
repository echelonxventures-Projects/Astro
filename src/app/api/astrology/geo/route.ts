/**
 * Same-origin geocoding proxy (OpenStreetMap Nominatim).
 * Browser->Nominatim direct calls are blocked by our CSP and violate Nominatim's
 * usage policy (needs an identifying User-Agent); proxying server-side fixes both
 * and lets us cache lookups.
 *
 * GET /api/astrology/geo?q=new%20york -> { results: [{ displayName, name, latitude, longitude, country, state }] }
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { get as cacheGet, set as cacheSet } from '@/lib/cache'
import { logError, logger } from '@/lib/logger'

interface GeoResult {
  displayName: string
  name: string
  latitude: string
  longitude: string
  country: string
  state: string
}

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json({ results: [] })
  if (q.length > 120) {
    return NextResponse.json({ error: 'Query too long' }, { status: 400 })
  }

  const cacheKey = `geo:nominatim:${q.toLowerCase()}`
  try {
    const cached = await cacheGet<GeoResult[]>(cacheKey)
    if (cached) return NextResponse.json({ results: cached })

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'StarPathAstrology/1.0 (location search; contact platform admin)',
        Accept: 'application/json',
      },
    })
    clearTimeout(timer)
    if (!res.ok) {
      return NextResponse.json({ error: `Geocoder unavailable (${res.status})` }, { status: 502 })
    }
    const data = (await res.json()) as Array<{
      display_name: string
      lat: string
      lon: string
      address?: { country?: string; state?: string }
    }>
    const results: GeoResult[] = data.map(item => ({
      displayName: item.display_name,
      name: item.display_name.split(',')[0],
      latitude: item.lat,
      longitude: item.lon,
      country: item.address?.country ?? '',
      state: item.address?.state ?? '',
    }))
    await cacheSet(cacheKey, results, 12 * 3600)
    return NextResponse.json({ results })
  } catch (error) {
    logError('geo proxy error', error)
    logger.debug({ q }, 'geo lookup failed')
    return NextResponse.json({ error: 'Geocoder temporarily unavailable' }, { status: 502 })
  }
}
