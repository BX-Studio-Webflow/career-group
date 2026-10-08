import type { Context } from 'hono';

import type { AppEnv } from './types.js';

export const JOB_CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=600';

export function fail(context: Context<AppEnv>, status: 400 | 404 | 422 | 500 | 502, error: string, message: string) {
	return context.json({ ok: false, error, message }, status, {
		'Cache-Control': 'no-store',
	});
}
