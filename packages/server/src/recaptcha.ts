const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export const RECAPTCHA_ACTION = 'apply';

const DEFAULT_MIN_SCORE = 0.5;

export interface RecaptchaFailure {
	ok: false;
	status: 400 | 502;
	error: 'recaptcha_failed' | 'recaptcha_unavailable';
	message: string;
}

export function recaptchaMinScore(env: NodeJS.ProcessEnv = process.env): number {
	const raw = env.RECAPTCHA_MIN_SCORE?.trim() ?? '';
	if (!raw) {
		return DEFAULT_MIN_SCORE;
	}

	const score = Number(raw);
	if (!Number.isFinite(score) || score < 0 || score > 1) {
		return DEFAULT_MIN_SCORE;
	}

	return score;
}

export async function verifyRecaptcha(token: string, remoteIp = ''): Promise<{ ok: true } | RecaptchaFailure> {
	const secret = process.env.GOOGLE_RECAPTCHA_SECRET_KEY?.trim() ?? '';
	if (!secret) {
		return { ok: true };
	}

	const responseToken = token.trim();
	if (!responseToken) {
		return failed();
	}

	const body = new URLSearchParams();
	body.set('secret', secret);
	body.set('response', responseToken);
	if (remoteIp) {
		body.set('remoteip', remoteIp);
	}

	let response: Response;
	try {
		response = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});
	} catch (error) {
		console.error('reCAPTCHA verification request failed:', error instanceof Error ? error.message : 'unknown');
		return unavailable();
	}

	if (!response.ok) {
		console.error(`reCAPTCHA verification HTTP ${response.status}`);
		return unavailable();
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		console.error('reCAPTCHA verification response was not JSON');
		return unavailable();
	}

	if (!accepted(payload)) {
		return failed();
	}

	return { ok: true };
}

function accepted(payload: unknown): boolean {
	if (!payload || typeof payload !== 'object') {
		console.error('reCAPTCHA rejected: response was empty');
		return false;
	}

	const record = payload as Record<string, unknown>;
	const success = record.success === true;
	const action = typeof record.action === 'string' ? record.action : '';
	const score = typeof record.score === 'number' ? record.score : 0;
	const codes = Array.isArray(record['error-codes']) ? record['error-codes'].filter((code) => typeof code === 'string').join(',') : '';
	if (!success || action !== RECAPTCHA_ACTION || score < recaptchaMinScore()) {
		console.error(`reCAPTCHA rejected: success=${success} action=${action || 'none'} score=${score}${codes ? ` ${codes}` : ''}`);
		return false;
	}

	return true;
}

function failed(): RecaptchaFailure {
	return {
		ok: false,
		status: 400,
		error: 'recaptcha_failed',
		message: 'The security check failed. Please try again.',
	};
}

function unavailable(): RecaptchaFailure {
	return {
		ok: false,
		status: 502,
		error: 'recaptcha_unavailable',
		message: 'The security check is unavailable right now.',
	};
}
