import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../types';
import { allowedOrigin, preflightResponse, withCors } from '../utils/cors';

export const cors = createMiddleware<AppEnv>(async (context, next) => {
	const origin = allowedOrigin(context.req.raw, process.env.CORS_ORIGINS || '*');
	if (context.req.method === 'OPTIONS') {
		return preflightResponse(origin);
	}

	await next();
	context.res = withCors(context.res, origin);
});
