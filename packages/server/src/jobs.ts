import { dangerouslyDeleteByTag } from '@vercel/functions';
import type { Context } from 'hono';

import { bullhornClient, BullhornHttpError, ConfigError, resetBullhornState } from './bullhorn/client.js';
import { readConfig } from './bullhorn/config.js';
import { MapsConfigError, MapsUnavailableError, resetGeocodeCache, UnresolvedPlaceError } from './geo.js';
import { fail, JOB_CACHE_TAG, jobCacheHeaders } from './http.js';
import { verifyRecaptcha } from './recaptcha.js';
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
			return context.json({ ok: true, ...result }, 200, jobCacheHeaders());
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

		return context.json({ ok: true, job }, 200, jobCacheHeaders());
	});
}

export async function purgeCache(context: Context<AppEnv>) {
	resetBullhornState();
	resetGeocodeCache();
	try {
		await dangerouslyDeleteByTag(JOB_CACHE_TAG);
	} catch (error) {
		console.error('CDN cache purge failed:', error instanceof Error ? error.message : 'unknown');
		return fail(context, 502, 'cache_purge_failed', 'The edge cache could not be purged.');
	}

	return context.json({ ok: true }, 200, {
		'Cache-Control': 'no-store',
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
	} catch (error) {
		const detail = error instanceof Error ? error.message : '';
		console.error('Application body could not be read:', detail || 'unknown');
		const tooBig = /too large|payload|body limit|max(?:imum)? size|413/i.test(detail);
		return fail(
			context,
			400,
			'invalid_application',
			tooBig
				? 'Resume must be 10 MB or smaller.'
				: 'The application could not be read. Fill in every required field and attach a PDF, DOC, or DOCX resume of 10 MB or smaller.',
		);
	}

	const parsed = await parseApplication(body);
	if (!parsed.ok) {
		return fail(context, 400, 'invalid_application', parsed.message);
	}

	const token = typeof body.recaptchaToken === 'string' ? body.recaptchaToken : '';
	const check = await verifyRecaptcha(token, clientIp(context.req.header('x-forwarded-for')));
	if (!check.ok) {
		return fail(context, check.status, check.error, check.message);
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

function clientIp(forwardedFor: string | undefined): string {
	return forwardedFor?.split(',')[0]?.trim() ?? '';
}
