import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '../types.js';

const REQUEST_ID_HEADER = 'X-Request-Id';

export const requestId = createMiddleware<AppEnv>(async (context, next) => {
	const incoming = context.req.header(REQUEST_ID_HEADER)?.trim();
	const value = incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();

	context.set('requestId', value);
	context.header(REQUEST_ID_HEADER, value);
	await next();
});
