import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

import type { ApplicationInput, ResumeFile } from '../validate.js';
import type { BullhornConfig } from './config.js';
import { DETAIL_FIELDS, LIST_FIELDS } from './fields.js';
import { quoteWhere } from './ids.js';
import { type JobDetail, type JobSummary, type ListQuery, mapJob, publishedJobsQuery } from './map.js';

export class BullhornHttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export class ConfigError extends Error {
	constructor() {
		super('Bullhorn is not configured.');
	}
}

interface Session {
	restUrl: string;
	bhRestToken: string;
	refreshToken: string;
	expiresAt: number;
}

interface TokenSet {
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
}

export interface JobList {
	total: number;
	start: number;
	count: number;
	jobs: JobSummary[];
}

export interface ApplyResult {
	alreadyApplied: boolean;
	resumeAttached: boolean;
}

const CACHE_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
	expiresAt: number;
	value: T;
}

function codeFromLocation(location: string, base: string): string | null {
	try {
		return new URL(location, base).searchParams.get('code');
	} catch {
		return null;
	}
}

async function authorizationCodeFromFetch(url: URL): Promise<string | null> {
	const response = await fetch(url, { redirect: 'manual' });
	const location = response.headers.get('location') ?? '';
	await response.body?.cancel();
	if (!location) {
		return null;
	}

	return codeFromLocation(location, url.origin);
}

function redirectHeaders(url: URL): Promise<{ status: number; location: string }> {
	const request = url.protocol === 'http:' ? httpRequest : httpsRequest;
	return new Promise((resolve, reject) => {
		const outbound = request(url, { method: 'GET' }, (response) => {
			response.resume();
			const header = response.headers.location;
			const location = Array.isArray(header) ? (header[0] ?? '') : (header ?? '');
			resolve({ status: response.statusCode ?? 0, location });
		});
		outbound.on('error', () => {
			reject(new BullhornHttpError(502, 'Bullhorn login failed.'));
		});
		outbound.end();
	});
}

async function authorizationCodeFromRedirects(start: URL): Promise<string> {
	let current = start;
	for (let hop = 0; hop < 5; hop += 1) {
		const { status, location } = await redirectHeaders(current);
		const code = location ? codeFromLocation(location, current.origin) : null;
		if (code) {
			return code;
		}

		const redirected = status >= 300 && status < 400 && location;
		if (!redirected) {
			console.error(`Bullhorn login did not return a code (${status})`);
			throw new BullhornHttpError(502, 'Bullhorn login failed.');
		}

		current = new URL(location, current);
	}

	console.error('Bullhorn login redirect did not include a code');
	throw new BullhornHttpError(502, 'Bullhorn login failed.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object';
}

function restUrl(value: string): string {
	return value.endsWith('/') ? value : `${value}/`;
}

export class BullhornClient {
	private cached: Session | null = null;
	private pending: Promise<Session> | null = null;
	private oauthUrl = 'https://auth.bullhornstaffing.com/oauth';
	private restLoginUrl = 'https://rest.bullhornstaffing.com/rest-services/login';
	private readonly lists = new Map<string, CacheEntry<JobList>>();
	private readonly details = new Map<number, CacheEntry<JobDetail>>();

	constructor(private readonly config: BullhornConfig) {}

	async searchPublished(query: ListQuery): Promise<JobList> {
		const key = JSON.stringify(query);
		const hit = this.lists.get(key);
		if (hit && hit.expiresAt > Date.now()) {
			return hit.value;
		}

		const params = {
			query: publishedJobsQuery(query),
			fields: LIST_FIELDS,
			count: String(query.count),
			start: String(query.start),
			sort: '-dateLastPublished',
		};
		const body = await this.readJson('job_search', 'search/JobOrder', params);
		const value = mapSearch(body, query);
		this.lists.set(key, { expiresAt: Date.now() + CACHE_MS, value });
		return value;
	}

	async getPublished(id: number): Promise<JobDetail | null> {
		const hit = this.details.get(id);
		if (hit && hit.expiresAt > Date.now()) {
			return hit.value;
		}

		const body = await this.readJson('job_detail', `entity/JobOrder/${id}`, { fields: DETAIL_FIELDS });
		if (body === null) {
			return null;
		}

		const job = mapJob(body);
		if (!job) {
			return null;
		}

		this.details.set(id, { expiresAt: Date.now() + CACHE_MS, value: job });
		return job;
	}

	async apply(jobId: number, application: ApplicationInput, resume: ResumeFile | null): Promise<ApplyResult | null> {
		const job = await this.getPublished(jobId);
		if (!job) {
			return null;
		}

		const candidateId = await this.findOrCreateCandidate(application);
		const existing = await this.findSubmission(candidateId, jobId);
		if (existing) {
			const resumeAttached = await this.attachResume(candidateId, resume);
			return { alreadyApplied: true, resumeAttached };
		}

		await this.createSubmission(candidateId, jobId);
		const resumeAttached = await this.attachResume(candidateId, resume);
		return { alreadyApplied: false, resumeAttached };
	}

	private async findOrCreateCandidate(application: ApplicationInput): Promise<number> {
		const existing = await this.findCandidate(application.email);
		if (existing) {
			return existing;
		}

		const payload: Record<string, string> = {
			firstName: application.firstName,
			lastName: application.lastName,
			name: `${application.firstName} ${application.lastName}`,
			email: application.email,
		};
		if (application.phone) {
			payload.phone = application.phone;
		}
		if (this.config.candidateStatus) {
			payload.status = this.config.candidateStatus;
		}

		const body = await this.sendJson('candidate_create', 'PUT', 'entity/Candidate', payload);
		return changedId(body);
	}

	private async findCandidate(email: string): Promise<number | null> {
		const body = await this.readJson('candidate_search', 'query/Candidate', {
			where: `email=${quoteWhere(email)}`,
			fields: 'id,email',
			count: '5',
		});
		return exactEmailId(body, email);
	}

	private async findSubmission(candidateId: number, jobId: number): Promise<number | null> {
		const body = await this.readJson('submission_search', 'query/JobSubmission', {
			where: `candidate.id=${candidateId} AND jobOrder.id=${jobId}`,
			fields: 'id',
			count: '1',
		});
		return firstId(body);
	}

	private async createSubmission(candidateId: number, jobId: number): Promise<void> {
		await this.sendJson('submission_create', 'PUT', 'entity/JobSubmission', {
			candidate: { id: candidateId },
			jobOrder: { id: jobId },
			status: this.config.submissionStatus,
			dateWebResponse: Date.now(),
		});
	}

	private async attachResume(candidateId: number, resume: ResumeFile | null): Promise<boolean> {
		if (!resume) {
			return true;
		}

		try {
			const response = await this.rest(
				'resume_upload',
				`file/Candidate/${candidateId}/raw`,
				{
					externalID: 'Resume',
					fileType: 'SAMPLE',
					name: resume.name,
				},
				{
					method: 'PUT',
					headers: { 'Content-Type': resume.mediaType },
					body: new Blob([new Uint8Array(resume.bytes)], { type: resume.mediaType }),
				},
			);
			if (!response.ok) {
				await response.body?.cancel();
				console.error(`Bullhorn resume upload failed: ${response.status}`);
				return false;
			}

			await response.body?.cancel();
			return true;
		} catch (error) {
			console.error('Bullhorn resume upload failed:', error instanceof Error ? error.message : 'unknown');
			return false;
		}
	}

	private async readJson(label: string, path: string, params: Record<string, string>, init?: RequestInit): Promise<unknown> {
		const response = await this.rest(label, path, params, init);
		if (response.status === 404) {
			await response.body?.cancel();
			return null;
		}

		if (!response.ok) {
			await response.body?.cancel();
			console.error(`Bullhorn ${label} failed: ${response.status}`);
			throw new BullhornHttpError(response.status, 'Bullhorn request failed.');
		}

		return response.json() as Promise<unknown>;
	}

	private async sendJson(label: string, method: string, path: string, payload: unknown): Promise<unknown> {
		return this.readJson(
			label,
			path,
			{},
			{
				method,
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(payload),
			},
		);
	}

	private async rest(label: string, path: string, params: Record<string, string>, init?: RequestInit): Promise<Response> {
		return this.withSession(async (session) => {
			const url = new URL(path, session.restUrl);
			for (const [key, value] of Object.entries(params)) {
				url.searchParams.set(key, value);
			}
			url.searchParams.set('BhRestToken', session.bhRestToken);

			const response = await fetch(url, init);
			if (response.status === 401) {
				await response.body?.cancel();
				console.error(`Bullhorn ${label} rejected the session`);
				throw new BullhornHttpError(401, 'Bullhorn session expired.');
			}

			return response;
		});
	}

	private async withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
		try {
			return await fn(await this.session());
		} catch (error) {
			if (!(error instanceof BullhornHttpError) || error.status !== 401) {
				throw error;
			}

			this.cached = null;
			return fn(await this.session());
		}
	}

	private session(): Promise<Session> {
		const { cached } = this;
		if (cached && cached.expiresAt > Date.now() + 30_000) {
			return Promise.resolve(cached);
		}

		if (!this.pending) {
			this.pending = this.login().finally(() => {
				this.pending = null;
			});
		}

		return this.pending;
	}

	private async login(): Promise<Session> {
		const { cached } = this;
		if (cached?.refreshToken) {
			try {
				const next = await this.openSession(await this.exchange({ grant_type: 'refresh_token', refresh_token: cached.refreshToken }));
				this.cached = next;
				return next;
			} catch (error) {
				console.error('Bullhorn refresh failed:', error instanceof Error ? error.message : 'unknown');
				this.cached = null;
			}
		}

		const code = await this.authorizationCode();
		const next = await this.openSession(
			await this.exchange({
				grant_type: 'authorization_code',
				code,
				client_id: this.config.clientId,
				client_secret: this.config.clientSecret,
				redirect_uri: this.config.redirectUri,
			}),
		);
		this.cached = next;
		return next;
	}

	private async discoverEndpoints(): Promise<void> {
		const url = new URL('https://rest.bullhornstaffing.com/rest-services/loginInfo');
		url.searchParams.set('username', this.config.username);
		const response = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!response.ok) {
			await response.body?.cancel();
			console.error(`Bullhorn loginInfo failed: ${response.status}`);
			return;
		}

		const body: unknown = await response.json();
		if (!isRecord(body)) {
			return;
		}

		if (typeof body.oauthUrl === 'string' && body.oauthUrl) {
			this.oauthUrl = body.oauthUrl.replace(/\/$/, '');
		}
		if (typeof body.restUrl === 'string' && body.restUrl) {
			this.restLoginUrl = `${body.restUrl.replace(/\/$/, '')}/login`;
		}
	}

	private async authorizationCode(): Promise<string> {
		await this.discoverEndpoints();
		const url = new URL('authorize', `${this.oauthUrl}/`);
		url.searchParams.set('client_id', this.config.clientId);
		url.searchParams.set('response_type', 'code');
		url.searchParams.set('action', 'Login');
		url.searchParams.set('username', this.config.username);
		url.searchParams.set('password', this.config.password);
		url.searchParams.set('redirect_uri', this.config.redirectUri);

		const fromFetch = await authorizationCodeFromFetch(url);
		if (fromFetch) {
			return fromFetch;
		}

		return authorizationCodeFromRedirects(url);
	}

	private async exchange(fields: Record<string, string>): Promise<TokenSet> {
		const response = await fetch(new URL('token', `${this.oauthUrl}/`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
			body: new URLSearchParams(fields),
		});

		if (!response.ok) {
			await response.body?.cancel();
			console.error(`Bullhorn token exchange failed: ${response.status}`);
			throw new BullhornHttpError(response.status, 'Bullhorn token exchange failed.');
		}

		const body: unknown = await response.json();
		if (!isRecord(body) || typeof body.access_token !== 'string') {
			throw new BullhornHttpError(502, 'Bullhorn token response was incomplete.');
		}

		const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';
		const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 600;
		return { accessToken: body.access_token, refreshToken, expiresIn };
	}

	private async openSession(token: TokenSet): Promise<Session> {
		const url = new URL(this.restLoginUrl);
		url.searchParams.set('version', '*');
		url.searchParams.set('access_token', token.accessToken);

		const response = await fetch(url, { method: 'POST', headers: { Accept: 'application/json' } });
		if (!response.ok) {
			await response.body?.cancel();
			console.error(`Bullhorn REST login failed: ${response.status}`);
			throw new BullhornHttpError(response.status, 'Bullhorn REST login failed.');
		}

		const body: unknown = await response.json();
		if (!isRecord(body) || typeof body.BhRestToken !== 'string' || typeof body.restUrl !== 'string') {
			throw new BullhornHttpError(502, 'Bullhorn REST login was incomplete.');
		}

		return {
			restUrl: restUrl(body.restUrl),
			bhRestToken: body.BhRestToken,
			refreshToken: token.refreshToken,
			expiresAt: Date.now() + token.expiresIn * 1000,
		};
	}
}

function mapSearch(body: unknown, query: ListQuery): JobList {
	if (!isRecord(body) || !Array.isArray(body.data)) {
		throw new BullhornHttpError(502, 'Bullhorn job search was incomplete.');
	}

	const jobs = body.data.map((row) => mapJob(row)).filter((job): job is JobDetail => job !== null);
	const total = typeof body.total === 'number' ? body.total : jobs.length;
	return {
		total,
		start: query.start,
		count: jobs.length,
		jobs: jobs.map((job) => ({
			id: job.id,
			title: job.title,
			location: job.location,
			employmentType: job.employmentType,
			category: job.category,
			salary: job.salary,
			salaryMin: job.salaryMin,
			salaryMax: job.salaryMax,
			salaryUnit: job.salaryUnit,
			publishedAt: job.publishedAt,
			division: job.division,
			remote: job.remote,
		})),
	};
}

function exactEmailId(body: unknown, email: string): number | null {
	if (!isRecord(body) || !Array.isArray(body.data)) {
		return null;
	}

	const match = body.data.find((row) => isRecord(row) && typeof row.email === 'string' && row.email.toLowerCase() === email);
	if (!match || !isRecord(match) || typeof match.id !== 'number') {
		return null;
	}

	return match.id;
}

function firstId(body: unknown): number | null {
	if (!isRecord(body) || !Array.isArray(body.data)) {
		return null;
	}

	const row = body.data[0];
	if (!isRecord(row) || typeof row.id !== 'number') {
		return null;
	}

	return row.id;
}

function changedId(body: unknown): number {
	if (!isRecord(body) || typeof body.changedEntityId !== 'number') {
		throw new BullhornHttpError(502, 'Bullhorn did not return an id.');
	}

	return body.changedEntityId;
}

let singleton: BullhornClient | null = null;

export function bullhornClient(config: BullhornConfig): BullhornClient {
	if (!singleton) {
		singleton = new BullhornClient(config);
	}

	return singleton;
}

export function resetBullhornState(): void {
	singleton = null;
}
