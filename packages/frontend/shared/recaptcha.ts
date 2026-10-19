const ACTION = 'apply';

declare const GOOGLE_RECAPTCHA_SITE_KEY: string;

let loading: Promise<void> | null = null;

function siteKey(): string {
	const runtime = window.GOOGLE_RECAPTCHA_SITE_KEY?.trim() ?? '';
	if (runtime) {
		return runtime;
	}

	return GOOGLE_RECAPTCHA_SITE_KEY.trim();
}

function loadScript(key: string): Promise<void> {
	if (window.grecaptcha) {
		return Promise.resolve();
	}

	if (!loading) {
		loading = new Promise((resolve, reject) => {
			const script = document.createElement('script');
			script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => {
				loading = null;
				reject(new Error('recaptcha_script'));
			};
			document.head.appendChild(script);
		});
	}

	return loading;
}

export async function recaptchaToken(): Promise<string | null> {
	const key = siteKey();
	if (!key) {
		return '';
	}

	try {
		await loadScript(key);
		const { grecaptcha } = window;
		if (!grecaptcha) {
			return null;
		}

		const token = await new Promise<string>((resolve, reject) => {
			grecaptcha.ready(() => {
				grecaptcha.execute(key, { action: ACTION }).then(resolve, reject);
			});
		});
		return token.trim() || null;
	} catch (error) {
		console.error('[Careers] reCAPTCHA failed', error);
		return null;
	}
}
