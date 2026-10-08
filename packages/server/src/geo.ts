export const RADIUS_MILES = 50;

export interface GeoPoint {
	latitude: number;
	longitude: number;
}

export class UnresolvedPlaceError extends Error {
	constructor() {
		super('Unresolved location.');
	}
}

export class MapsConfigError extends Error {
	constructor() {
		super('Location search is not configured.');
	}
}

export class MapsUnavailableError extends Error {
	constructor() {
		super('Location search is unavailable.');
	}
}

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const EARTH_RADIUS_MILES = 3958.8;
const cache = new Map<string, GeoPoint | null>();

export function resetGeocodeCache(): void {
	cache.clear();
}

export function withinRadius(origin: GeoPoint, point: GeoPoint): boolean {
	return milesBetween(origin, point) <= RADIUS_MILES;
}

export async function geocode(place: string): Promise<GeoPoint | null> {
	const query = place.trim().replace(/\s+/g, ' ');
	if (!query) {
		return null;
	}

	const cacheKey = query.toLowerCase();
	if (cache.has(cacheKey)) {
		return cache.get(cacheKey) ?? null;
	}

	const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? '';
	if (!apiKey) {
		throw new MapsConfigError();
	}

	const url = new URL(GEOCODE_URL);
	url.searchParams.set('address', query);
	url.searchParams.set('key', apiKey);

	let response: Response;
	try {
		response = await fetch(url);
	} catch {
		console.error('[geo] Geocoding request failed');
		throw new MapsUnavailableError();
	}

	if (!response.ok) {
		console.error(`[geo] Geocoding HTTP ${response.status}`);
		throw new MapsUnavailableError();
	}

	const body: unknown = await response.json();
	const status = isRecord(body) && typeof body.status === 'string' ? body.status : '';
	if (status === 'ZERO_RESULTS') {
		cache.set(cacheKey, null);
		return null;
	}
	if (status !== 'OK') {
		const reason = isRecord(body) && typeof body.error_message === 'string' ? body.error_message : '';
		console.error(`[geo] Geocoding status ${status || 'unknown'}${reason ? `: ${reason}` : ''}`);
		throw new MapsUnavailableError();
	}

	const point = readPoint(body);
	if (!point) {
		cache.set(cacheKey, null);
		return null;
	}

	cache.set(cacheKey, point);
	return point;
}

function milesBetween(origin: GeoPoint, point: GeoPoint): number {
	const latitudeDelta = radians(point.latitude - origin.latitude);
	const longitudeDelta = radians(point.longitude - origin.longitude);
	const originLatitude = radians(origin.latitude);
	const pointLatitude = radians(point.latitude);
	const haversine =
		Math.sin(latitudeDelta / 2) ** 2 + Math.cos(originLatitude) * Math.cos(pointLatitude) * Math.sin(longitudeDelta / 2) ** 2;
	return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function radians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function readPoint(body: unknown): GeoPoint | null {
	if (!isRecord(body) || !Array.isArray(body.results)) {
		return null;
	}

	const result = body.results[0];
	if (!isRecord(result) || !isRecord(result.geometry) || !isRecord(result.geometry.location)) {
		return null;
	}

	const { lat, lng } = result.geometry.location;
	if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
		return null;
	}

	return { latitude: lat, longitude: lng };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object';
}
