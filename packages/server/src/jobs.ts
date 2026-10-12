import type { Context } from 'hono';

import { bullhornClient, BullhornHttpError, ConfigError } from './bullhorn/client.js';
import { readConfig } from './bullhorn/config.js';
import { MapsConfigError, MapsUnavailableError, UnresolvedPlaceError } from './geo.js';
import { fail, JOB_CACHE_CONTROL } from './http.js';
import type { AppEnv } from './types.js';
import { parseApplication, parseJobParam, parseListQuery } from './validate.js';

function clientFromEnv() {
	const config = readConfig();
	if (!config) {
		throw new ConfigError();
	}

	return bullhornClient(config);
}

async function bullhornRoute(context: Context<AppEnv>, run: () => Promise<Response>) {
	try {
		return await run();
	} catch (error) {
		if (error instanceof ConfigError) {
			return fail(context, 500, 'configuration_error', 'Bullhorn is not configured.');
		}

		if (error instanceof BullhornHttpError) {
			console.error(`Bullhorn error: ${error.status}`);
			return fail(context, 502, 'bullhorn_unavailable', 'Bullhorn is unavailable right now.');
		}

		throw error;
	}
}

export async function listJobs(context: Context<AppEnv>) {
	const parsed = parseListQuery(context.req.query());
	if (!parsed.ok) {
		return fail(context, 400, 'invalid_query', parsed.message);
	}

	const { value } = parsed;
	return bullhornRoute(context, async () => {
		try {
			const result = value.near ? await clientFromEnv().searchNear(value.near) : await clientFromEnv().searchPublished(value);
			return context.json({ ok: true, ...result }, 200, {
				'Cache-Control': JOB_CACHE_CONTROL,
			});
		} catch (error) {
			if (error instanceof UnresolvedPlaceError) {
				return fail(context, 422, 'unresolved_location', "We couldn't find that location. Try a city and state.");
			}
			if (error instanceof MapsConfigError) {
				return fail(context, 500, 'configuration_error', 'Location search is not configured.');
			}
			if (error instanceof MapsUnavailableError) {
				return fail(context, 502, 'maps_unavailable', 'Location search is unavailable right now.');
			}
			throw error;
		}
	});
}

export async function getJob(context: Context<AppEnv>) {
	const id = parseJobParam(context.req.param('id') ?? '');
	if (!id) {
		return fail(context, 400, 'invalid_job', 'Job id is invalid.');
	}

	return bullhornRoute(context, async () => {
		const job = await clientFromEnv().getPublished(id);
		if (!job) {
			return fail(context, 404, 'not_found', 'Job not found.');
		}

		return context.json({ ok: true, job }, 200, {
			'Cache-Control': JOB_CACHE_CONTROL,
		});
	});
}

export async function applyToJob(context: Context<AppEnv>) {
	const id = parseJobParam(context.req.param('id') ?? '');
	if (!id) {
		return fail(context, 400, 'invalid_job', 'Job id is invalid.');
	}

	let body: Record<string, string | File>;
	try {
		body = await context.req.parseBody();
	} catch {
		return fail(context, 400, 'invalid_application', 'Check the application fields and try again.');
	}

	const parsed = await parseApplication(body);
	if (!parsed.ok) {
		return fail(context, 400, 'invalid_application', parsed.message);
	}

	const { value } = parsed;
	return bullhornRoute(context, async () => {
		const { resume, ...application } = value;
		const result = await clientFromEnv().apply(id, application, resume);
		if (!result) {
			return fail(context, 404, 'not_found', 'Job not found.');
		}

		return context.json({ ok: true, ...result }, 200, {
			'Cache-Control': 'no-store',
		});
	});
}
