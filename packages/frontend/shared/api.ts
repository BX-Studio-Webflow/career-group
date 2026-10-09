import type { JobDetail, JobSummary } from './jobs';

export type { JobDetail, JobSummary };

export function readApiOrigin(): string | null {
	const runtime = window.CAREERS_API_ORIGIN?.replace(/\/$/, '') ?? '';
	if (runtime) {
		return runtime;
	}

	if (API_ORIGIN) {
		return API_ORIGIN.replace(/\/$/, '');
	}

	return null;
}

export function apiUrl(path: string): string | null {
	const origin = readApiOrigin();
	if (!origin) {
		return null;
	}

	return `${origin}${path}`;
}

interface JobListResponse {
	ok?: boolean;
	total?: number;
	jobs?: JobSummary[];
}

export async function fetchJobsNear(near: string): Promise<JobSummary[] | string> {
	const url = apiUrl(`/api/jobs?near=${encodeURIComponent(near)}`);
	if (!url) {
		throw new Error('missing_api_origin');
	}

	const response = await fetch(url, { headers: { Accept: 'application/json' } });
	if (response.status === 422) {
		try {
			const body = (await response.json()) as { message?: string };
			const message = body.message?.trim();
			if (message) {
				return message;
			}
		} catch (error) {
			console.error('[job.ts] Unresolved location response was not readable.', error);
		}
		return "We couldn't find that location. Try a city and state.";
	}
	if (!response.ok) {
		throw new Error('jobs_failed');
	}

	const body = (await response.json()) as JobListResponse;
	return body.jobs ?? [];
}

export async function fetchPublishedJobs(): Promise<JobSummary[]> {
	const jobs: JobSummary[] = [];
	const seen = new Set<number>();
	const count = 200;
	let start = 0;

	while (jobs.length < 500) {
		const url = apiUrl(`/api/jobs?start=${start}&count=${count}`);
		if (!url) {
			throw new Error('missing_api_origin');
		}

		const response = await fetch(url, { headers: { Accept: 'application/json' } });
		if (!response.ok) {
			throw new Error('jobs_failed');
		}

		const body = (await response.json()) as JobListResponse;
		const page = body.jobs ?? [];
		for (const job of page) {
			if (!seen.has(job.id)) {
				seen.add(job.id);
				jobs.push(job);
			}
		}

		start += count;
		if (page.length === 0 || start >= (body.total ?? 0) || jobs.length >= 500) {
			break;
		}
	}

	return jobs;
}

export async function fetchJob(id: string): Promise<JobDetail | null> {
	const url = apiUrl(`/api/jobs/${id}`);
	if (!url) {
		throw new Error('missing_api_origin');
	}

	const response = await fetch(url, { headers: { Accept: 'application/json' } });
	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error('job_failed');
	}

	const body = (await response.json()) as { job?: JobDetail };
	return body.job ?? null;
}

export interface ApplyResult {
	ok: boolean;
	alreadyApplied?: boolean;
	resumeAttached?: boolean;
	message?: string;
}

export async function submitApplication(id: string, body: FormData): Promise<ApplyResult> {
	const url = apiUrl(`/api/jobs/${id}/apply`);
	if (!url) {
		return { ok: false, message: 'Careers API is not configured.' };
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: { Accept: 'application/json' },
		body,
	});
	const payload = (await response.json()) as ApplyResult & { message?: string };
	return {
		ok: response.ok && payload.ok === true,
		alreadyApplied: payload.alreadyApplied,
		resumeAttached: payload.resumeAttached,
		message: payload.message,
	};
}
