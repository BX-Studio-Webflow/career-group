import type { Context } from 'hono';

import type { AppEnv } from './types.js';

export const JOB_CACHE_CONTROL = 'public, s-maxage=3600, stale-while-revalidate=7200';
export const JOB_CACHE_TAG = 'jobs';

export function jobCacheHeaders(): Record<string, string> {
	return {
		'Cache-Control': JOB_CACHE_CONTROL,
		'Vercel-Cache-Tag': JOB_CACHE_TAG,
	};
}

export function fail(context: Context<AppEnv>, status: 400 | 404 | 422 | 500 | 502, error: string, message: string) {
	return context.json({ ok: false, error, message }, status, {
		'Cache-Control': 'no-store',
	});
}
