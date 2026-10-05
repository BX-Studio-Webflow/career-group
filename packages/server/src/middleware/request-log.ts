import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../types.js';

export const requestLog = createMiddleware<AppEnv>(async (context, next) => {
	const startedAt = Date.now();
	await next();

	console.log(
		JSON.stringify({
			requestId: context.get('requestId'),
			method: context.req.method,
			path: context.req.path,
			status: context.res.status,
			durationMs: Date.now() - startedAt,
		}),
	);
});
