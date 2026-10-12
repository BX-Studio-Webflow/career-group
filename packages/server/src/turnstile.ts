export type TurnstileVerdict = 'ok' | 'rejected' | 'unavailable' | 'unconfigured';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const CAREER_HOSTS = new Set(['careergroupcompanies.com', 'www.careergroupcompanies.com']);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object';
}

function allowedHostname(hostname: string): boolean {
	const host = hostname.trim().toLowerCase();
	if (CAREER_HOSTS.has(host) || host.endsWith('.webflow.io')) {
		return true;
	}

	const extra = (process.env.TURNSTILE_HOSTNAMES ?? '')
		.split(',')
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
	return extra.includes(host);
}

export async function verifyTurnstile(token: string, remoteIp: string): Promise<TurnstileVerdict> {
	const secret = process.env.TURNSTILE_SECRET?.trim() ?? '';
	if (!secret) {
		return 'unconfigured';
	}
	if (token.length === 0 || token.length > 2048) {
		return 'rejected';
	}

	const params = new URLSearchParams({ secret, response: token });
	if (remoteIp) {
		params.set('remoteip', remoteIp);
	}

	try {
		const response = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: params,
			signal: AbortSignal.timeout(10_000),
		});
		let body: unknown;
		try {
			body = await response.json();
		} catch {
			console.error(`Turnstile verification failed: ${response.status}`);
			return 'unavailable';
		}

		if (!isRecord(body)) {
			return 'unavailable';
		}
		if (body.success !== true || typeof body.hostname !== 'string' || !allowedHostname(body.hostname)) {
			return 'rejected';
		}

		return 'ok';
	} catch (error) {
		console.error('Turnstile verification failed:', error instanceof Error ? error.message : 'unknown');
		return 'unavailable';
	}
}
