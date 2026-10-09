import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import app from '../src/app.js';
import { resetBullhornState } from '../src/bullhorn/client.js';
import { escapeLucene, geocodePlace, mapJob, publishedJobsQuery } from '../src/bullhorn/map.js';
import { resetGeocodeCache } from '../src/geo.js';

const REST = 'https://rest91.bullhornstaffing.com/rest-services/corp/';
const ENV_KEYS = [
	'BULLHORN_CLIENT_ID',
	'BULLHORN_CLIENT_SECRET',
	'BULLHORN_API_USERNAME',
	'BULLHORN_API_PASSWORD',
	'BULLHORN_SUBMISSION_STATUS',
	'BULLHORN_CANDIDATE_STATUS',
	'CORS_ORIGINS',
	'GOOGLE_MAPS_API_KEY',
] as const;

function publishedJob(id: number, extra: Record<string, unknown> = {}) {
	return {
		id,
		title: id === 11 ? 'Hidden role' : 'Accountant',
		isOpen: true,
		isPublic: true,
		isDeleted: false,
		employmentType: 'Permanent',
		salary: 80000,
		salaryUnit: 'Per Year',
		address: { city: 'Austin', state: 'TX', countryName: 'United States' },
		publishedCategory: { id: 1, name: 'Accounting' },
		dateLastPublished: 1_700_000_000_000,
		publicDescription: '<p>Hello</p><script>alert(1)</script>',
		...extra,
	};
}

class FakeBullhorn {
	calls: string[] = [];
	urls: string[] = [];
	candidate: { id: number; email: string } | null = null;
	submissions = new Set<string>();
	createdCandidates = 0;
	createdSubmissions = 0;
	fileUploads = 0;
	resumeStatus = 200;
	geocodeStatus = 'OK';
	geocodeKeys: string[] = [];
	lastSubmission: unknown = null;
	job: Record<string, unknown> | null = publishedJob(10);
	searchRows: unknown[] = [publishedJob(10), publishedJob(11, { isPublic: false })];

	async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
		const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
		const method = (init?.method ?? 'GET').toUpperCase();
		this.calls.push(`${method} ${url.pathname}`);
		this.urls.push(url.toString());

		if (url.pathname.endsWith('/loginInfo')) {
			return Response.json({
				oauthUrl: 'https://auth-west.bullhornstaffing.com/oauth',
				restUrl: 'https://rest-west.bullhornstaffing.com/rest-services',
			});
		}

		if (url.pathname === '/oauth/authorize') {
			return new Response(null, {
				status: 302,
				headers: { location: 'https://auth.bullhornstaffing.com/oauth/authorize?code=abc' },
			});
		}

		if (url.pathname === '/oauth/token') {
			return Response.json({ access_token: 'access', refresh_token: 'refresh', expires_in: 600 });
		}

		if (url.pathname === '/rest-services/login') {
			return Response.json({ BhRestToken: 'rest-token', restUrl: REST });
		}

		if (url.pathname.endsWith('/search/JobOrder')) {
			return Response.json({ total: this.searchRows.length, data: this.searchRows });
		}

		if (url.pathname.endsWith('/entity/JobOrder/10')) {
			if (!this.job) {
				return new Response('missing', { status: 404 });
			}
			return Response.json({ data: this.job });
		}

		if (url.pathname.endsWith('/query/Candidate')) {
			const data = this.candidate ? [this.candidate] : [];
			return Response.json({ total: data.length, data });
		}

		if (url.pathname.endsWith('/entity/Candidate') && method === 'PUT') {
			this.createdCandidates += 1;
			this.candidate = { id: 5, email: 'ada@example.com' };
			return Response.json({ changedEntityId: 5 });
		}

		if (url.pathname.endsWith('/query/JobSubmission')) {
			const id = this.submissions.has('5:10') ? 8 : null;
			return Response.json({ total: id ? 1 : 0, data: id ? [{ id }] : [] });
		}

		if (url.pathname.endsWith('/entity/JobSubmission') && method === 'PUT') {
			this.createdSubmissions += 1;
			this.submissions.add('5:10');
			this.lastSubmission = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
			return Response.json({ changedEntityId: 8 });
		}

		if (url.pathname.includes('/file/Candidate/')) {
			this.fileUploads += 1;
			return new Response(null, { status: this.resumeStatus });
		}

		if (url.hostname === 'maps.googleapis.com') {
			const address = (url.searchParams.get('address') ?? '').trim().toLowerCase();
			this.geocodeKeys.push(url.searchParams.get('key') ?? '');
			if (this.geocodeStatus !== 'OK') {
				return Response.json({ status: this.geocodeStatus, results: [] });
			}

			const points: Record<string, { lat: number; lng: number }> = {
				'austin, tx': { lat: 30.2672, lng: -97.7431 },
				'austin, tx 78701': { lat: 30.2672, lng: -97.7431 },
				'round rock, tx 78664': { lat: 30.5083, lng: -97.6789 },
				'dallas, tx 75201': { lat: 32.7767, lng: -96.797 },
			};
			const point = points[address];
			if (!point) {
				return Response.json({ status: 'ZERO_RESULTS', results: [] });
			}

			return Response.json({ status: 'OK', results: [{ geometry: { location: point } }] });
		}

		return new Response('unexpected', { status: 500 });
	}
}

let fake: FakeBullhorn;

function setEnv(): void {
	process.env.BULLHORN_CLIENT_ID = 'client';
	process.env.BULLHORN_CLIENT_SECRET = 'secret';
	process.env.BULLHORN_API_USERNAME = 'api-user';
	process.env.BULLHORN_API_PASSWORD = 'api-password';
	process.env.BULLHORN_SUBMISSION_STATUS = 'Web Response';
	delete process.env.BULLHORN_CANDIDATE_STATUS;
	delete process.env.CORS_ORIGINS;
	delete process.env.GOOGLE_MAPS_API_KEY;
}

function clearEnv(): void {
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
}

function application(fields: Record<string, string> = {}, file?: File): FormData {
	const form = new FormData();
	form.set('firstName', fields.firstName ?? 'Ada');
	form.set('lastName', fields.lastName ?? 'Lovelace');
	form.set('email', fields.email ?? 'ada@example.com');
	form.set('phone', fields.phone ?? '555-0100');
	if (file) {
		form.set('resume', file);
	}
	return form;
}

beforeEach(() => {
	setEnv();
	resetBullhornState();
	resetGeocodeCache();
	fake = new FakeBullhorn();
	vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => fake.fetch(input, init));
});

afterEach(() => {
	clearEnv();
	vi.unstubAllGlobals();
	resetBullhornState();
});

describe('published job query', () => {
	it('keeps user text inside the title clause', () => {
		expect(escapeLucene('a+b:c')).toBe('a\\+b\\:c');
		expect(publishedJobsQuery({ q: 'isPublic:false' })).toBe('isDeleted:false AND isPublic:1 AND title:isPublic\\:false*');
	});

	it('drops unpublished jobs and strips script tags', () => {
		expect(mapJob(publishedJob(11, { isPublic: false }))).toBeNull();
		expect(mapJob(publishedJob(10, { isOpen: false, isPublic: 1 }))?.title).toBe('Accountant');
		expect(mapJob(publishedJob(10, { isDeleted: true, isPublic: 1 }))).toBeNull();
		expect(mapJob(publishedJob(10, { isPublic: 1 }))?.title).toBe('Accountant');
		expect(mapJob(publishedJob(10, { customDate1: Date.now() + 86_400_000 }))).toBeNull();
		expect(mapJob(publishedJob(10, { customDate1: Date.now() - 86_400_000 }))?.title).toBe('Accountant');
		expect(mapJob(publishedJob(10, { dateLastPublished: Date.now() + 86_400_000 }))).toBeNull();
		expect(mapJob(publishedJob(10))?.description).toBe('<p>Hello</p>');
		expect(mapJob(publishedJob(10))?.preview).toBe('Hello');
		expect(mapJob(publishedJob(10, { customText4: 'Short blurb' }))?.preview).toBe('Short blurb');
		expect(mapJob(publishedJob(10))?.location).toBe('Austin, TX');
		expect(
			mapJob(publishedJob(10, { address: { city: 'Miami', state: 'FL', countryName: '- None Specified -' } }))?.location,
		).toBe('Miami, FL');
		expect(mapJob(publishedJob(10, { address: { city: 'San Francisco', state: 'California', countryName: 'United States' } }))?.location).toBe(
			'San Francisco, CA',
		);
		expect(mapJob(publishedJob(10, { address: { city: 'London', state: '', countryName: 'United Kingdom' } }))?.location).toBe(
			'London, United Kingdom',
		);
		expect(mapJob(publishedJob(10, { customText5: 'Marketing' }))?.category).toBe('Marketing');
		expect(mapJob(publishedJob(10))?.category).toBe('Accounting');
		expect(mapJob(publishedJob(10, { customText10: 'Hybrid' }))).toMatchObject({ remote: false, worksite: 'Hybrid' });
		expect(mapJob(publishedJob(10, { customText10: 'Onsite' }))).toMatchObject({ remote: false, worksite: 'Onsite' });
		expect(
			mapJob(
				publishedJob(10, {
					customText15: 'Public Accountant',
					customFloat1: 90000,
					customFloat2: 110000,
					customText10: 'Remote(voluntary)',
					customText12: 'No',
				}),
			),
		).toMatchObject({ title: 'Public Accountant', salaryMin: 90000, salaryMax: 110000, salary: 110000, remote: true, worksite: 'Remote' });
		expect(mapJob(publishedJob(10, { customText12: 'Yes', customFloat2: 110000 }))?.salary).toBeNull();
		expect(mapJob(publishedJob(10, { payRate: 30, customFloat3: 30, salary: 0, salaryUnit: '' }))).toMatchObject({
			salary: 30,
			salaryMin: 30,
			salaryMax: 30,
			salaryUnit: 'hour',
		});
		expect(mapJob(publishedJob(10, { customText20: 'SB' }))?.division).toBe('Syndicatebleu');
		expect(mapJob(publishedJob(10, { customText20: 'Event' }))?.division).toBe('Career Group Events');
		expect(geocodePlace({ city: 'Austin', state: 'TX', zip: '78701', countryName: 'United States' })).toBe('Austin, TX 78701');
	});
});

describe('GET /api/jobs', () => {
	it('returns only published jobs and reuses the Bullhorn session', async () => {
		const first = await app.request('/api/jobs');
		const second = await app.request('/api/jobs?q=tax');

		expect(first.status).toBe(200);
		expect(first.headers.get('cache-control')).toBe('public, s-maxage=300, stale-while-revalidate=600');
		const body = (await first.json()) as { jobs: { title: string }[] };
		expect(body.jobs.map((job) => job.title)).toEqual(['Accountant']);
		expect(fake.calls.filter((call) => call.startsWith('GET /oauth/authorize'))).toHaveLength(1);
		expect(fake.urls.some((url) => decodeURIComponent(url).includes('isPublic:1'))).toBe(true);
		expect(second.status).toBe(200);
	});

	it('returns jobs within 50 miles and keeps the maps key off the response', async () => {
		process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
		fake.searchRows = [
			publishedJob(10, { address: { city: 'Austin', state: 'TX', zip: '78701', countryName: 'United States' } }),
			publishedJob(12, {
				title: 'Round Rock Role',
				address: { city: 'Round Rock', state: 'TX', zip: '78664', countryName: 'United States' },
			}),
			publishedJob(13, { title: 'Dallas Role', address: { city: 'Dallas', state: 'TX', zip: '75201', countryName: 'United States' } }),
			publishedJob(14, { title: 'Hidden', isPublic: false, address: { city: 'Austin', state: 'TX', zip: '78701', countryName: 'United States' } }),
			publishedJob(15, {
				title: 'Future',
				customDate1: Date.now() + 86_400_000,
				address: { city: 'Austin', state: 'TX', zip: '78701', countryName: 'United States' },
			}),
			publishedJob(16, { title: 'No place', address: { city: '', state: '', countryName: '' } }),
		];

		const response = await app.request('/api/jobs?near=Austin,%20TX');
		expect(response.status).toBe(200);
		const body = (await response.json()) as { jobs: { title: string }[] };
		expect(body.jobs.map((job) => job.title).sort()).toEqual(['Accountant', 'Round Rock Role']);
		expect(JSON.stringify(body)).not.toContain('test-maps-key');
		expect(fake.geocodeKeys).toContain('test-maps-key');
		expect(fake.urls.some((url) => decodeURIComponent(url).includes('isPublic:1'))).toBe(true);
	});

	it('reports an unrecognized location without a job list', async () => {
		process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
		const response = await app.request('/api/jobs?near=Nowhere,%20ZZ');
		expect(response.status).toBe(422);
		const body = (await response.json()) as { error: string; message: string };
		expect(body.error).toBe('unresolved_location');
		expect(body.message).toBe("We couldn't find that location. Try a city and state.");
		expect(JSON.stringify(body)).not.toContain('test-maps-key');
	});

	it('does not treat a maps failure as an unknown place', async () => {
		process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
		fake.geocodeStatus = 'OVER_QUERY_LIMIT';
		const response = await app.request('/api/jobs?near=Austin,%20TX');
		expect(response.status).toBe(502);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe('maps_unavailable');
		expect(JSON.stringify(body)).not.toContain('test-maps-key');
	});

	it('fails when the maps key is missing', async () => {
		const response = await app.request('/api/jobs?near=Austin,%20TX');
		expect(response.status).toBe(500);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe('configuration_error');
		expect(fake.calls).toHaveLength(0);
	});

	it('fails closed when Bullhorn credentials are missing', async () => {
		clearEnv();
		resetBullhornState();
		const response = await app.request('/api/jobs');
		expect(response.status).toBe(500);
		const body = (await response.json()) as { error: string };
		expect(body.error).toBe('configuration_error');
		expect(fake.calls).toHaveLength(0);
	});
});

describe('GET /api/jobs/:id', () => {
	it('returns the public description', async () => {
		const response = await app.request('/api/jobs/10');
		expect(response.status).toBe(200);
		const body = (await response.json()) as { job: { description: string; title: string } };
		expect(body.job.title).toBe('Accountant');
		expect(body.job.description).toBe('<p>Hello</p>');
	});

	it('returns 404 when the job is not published', async () => {
		fake.job = publishedJob(10, { isPublic: false });
		const response = await app.request('/api/jobs/10');
		expect(response.status).toBe(404);
	});
});

describe('POST /api/jobs/:id/apply', () => {
	it('creates one candidate and a Web Response submission', async () => {
		const response = await app.request('/api/jobs/10/apply', { method: 'POST', body: application() });
		expect(response.status).toBe(200);
		const body = (await response.json()) as { ok: boolean; alreadyApplied: boolean; resumeAttached: boolean };
		expect(body).toEqual({ ok: true, alreadyApplied: false, resumeAttached: true });
		expect(fake.createdCandidates).toBe(1);
		expect(fake.createdSubmissions).toBe(1);
		expect(fake.lastSubmission).toMatchObject({
			status: 'Web Response',
			candidate: { id: 5 },
			jobOrder: { id: 10 },
		});
	});

	it('reuses an existing candidate for a second job application', async () => {
		fake.candidate = { id: 5, email: 'ada@example.com' };
		const response = await app.request('/api/jobs/10/apply', { method: 'POST', body: application() });
		expect(response.status).toBe(200);
		expect(fake.createdCandidates).toBe(0);
		expect(fake.createdSubmissions).toBe(1);
	});

	it('does not create a second submission for the same job', async () => {
		fake.candidate = { id: 5, email: 'ada@example.com' };
		fake.submissions.add('5:10');
		const response = await app.request('/api/jobs/10/apply', { method: 'POST', body: application() });
		const body = (await response.json()) as { alreadyApplied: boolean };
		expect(response.status).toBe(200);
		expect(body.alreadyApplied).toBe(true);
		expect(fake.createdCandidates).toBe(0);
		expect(fake.createdSubmissions).toBe(0);
	});

	it('keeps the submission when the resume upload fails', async () => {
		fake.resumeStatus = 500;
		const file = new File(['resume'], 'ada.pdf', { type: 'application/pdf' });
		const response = await app.request('/api/jobs/10/apply', { method: 'POST', body: application({}, file) });
		const body = (await response.json()) as { ok: boolean; resumeAttached: boolean };
		expect(response.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.resumeAttached).toBe(false);
		expect(fake.createdSubmissions).toBe(1);
		expect(fake.fileUploads).toBe(1);
	});

	it('rejects an invalid email before calling Bullhorn', async () => {
		const response = await app.request('/api/jobs/10/apply', {
			method: 'POST',
			body: application({ email: 'not-an-email' }),
		});
		expect(response.status).toBe(400);
		expect(fake.calls).toHaveLength(0);
	});

	it('rejects a resume that is not a document', async () => {
		const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
		const response = await app.request('/api/jobs/10/apply', { method: 'POST', body: application({}, file) });
		expect(response.status).toBe(400);
		expect(fake.createdCandidates).toBe(0);
	});
});

describe('CORS', () => {
	it('allows the Career Group site and rejects other origins when the list is restricted', async () => {
		process.env.CORS_ORIGINS = 'https://careers.example.com';
		const allowed = await app.request('/health', { headers: { Origin: 'https://www.careergroupcompanies.com' } });
		const denied = await app.request('/health', { headers: { Origin: 'https://example.com' } });
		expect(allowed.headers.get('access-control-allow-origin')).toBe('https://www.careergroupcompanies.com');
		expect(denied.headers.get('access-control-allow-origin')).toBeNull();
	});
});
