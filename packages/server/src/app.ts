import { Hono } from 'hono';

import { fail } from './http';
import { applyToJob, getJob, listJobs } from './jobs';
import { cors } from './middleware/cors';
import { requestId } from './middleware/request-id';
import { requestLog } from './middleware/request-log';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.use('*', cors, requestId, requestLog);

app.get('/health', (context) => context.json({ ok: true, status: 'ok' }));
app.get('/api/jobs', listJobs);
app.get('/api/jobs/:id', getJob);
app.post('/api/jobs/:id/apply', applyToJob);

app.notFound((context) => fail(context, 404, 'not_found', 'Not found.'));
app.onError((error, context) => {
	console.error('Request failed:', error instanceof Error ? error.message : 'unknown');
	return fail(context, 500, 'internal_error', 'Request failed.');
});

export default app;
