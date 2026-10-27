interface Grecaptcha {
	ready(callback: () => void): void;
	execute(siteKey: string, options: { action: string }): Promise<string>;
}

interface Window {
	CAREERS_API_ORIGIN?: string;
	CAREERS_LIMIT?: number;
	GOOGLE_RECAPTCHA_SITE_KEY?: string;
	grecaptcha?: Grecaptcha;
}

declare const API_ORIGIN: string;
