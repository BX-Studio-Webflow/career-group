import { existsSync } from 'node:fs';

import { serve } from '@hono/node-server';
import { config } from 'dotenv';

import app from './app.js';

if (existsSync('.env')) {
	config();
}

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Careers API listening on http://localhost:${info.port}`);
});
