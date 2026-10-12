export const MAX_RESUME_BYTES = 4 * 1024 * 1024;

const RESUME_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

function value(form: HTMLFormElement, target: string): string {
	const field = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[dev-target="${target}"]`);
	return field?.value.trim() ?? '';
}

function isEmail(value: string): boolean {
	return value.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function resumeError(file: File): string | null {
	if (file.size > MAX_RESUME_BYTES) {
		return 'Resume must be 4 MB or smaller.';
	}

	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (!RESUME_EXTENSIONS.has(extension)) {
		return 'Resume must be a PDF, DOC, or DOCX file.';
	}

	return null;
}

export function applicationFormData(form: HTMLFormElement): { ok: true; body: FormData } | { ok: false; message: string } {
	const firstName = value(form, 'first-name');
	const lastName = value(form, 'last-name');
	const email = value(form, 'email');
	const phone = value(form, 'phone');
	const city = value(form, 'city');
	const state = value(form, 'state');
	const referral = value(form, 'referral');
	const linkedinUrl = value(form, 'linkedin-url');
	const portfolioUrl = value(form, 'porfolio');
	const resume = form.querySelector<HTMLInputElement>('[dev-target="file-upload"]')?.files?.[0];
	const token = form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value.trim() ?? '';

	if (!firstName) {
		return { ok: false, message: 'Enter a first name.' };
	}
	if (firstName.length > 50) {
		return { ok: false, message: 'Enter a shorter first name.' };
	}
	if (!lastName) {
		return { ok: false, message: 'Enter a last name.' };
	}
	if (lastName.length > 50) {
		return { ok: false, message: 'Enter a shorter last name.' };
	}
	if (!isEmail(email)) {
		return { ok: false, message: 'Enter a valid email address.' };
	}
	if (!phone) {
		return { ok: false, message: 'Enter a phone number.' };
	}
	if (phone.length > 50) {
		return { ok: false, message: 'Enter a shorter phone number.' };
	}
	if (!city) {
		return { ok: false, message: 'Enter a city.' };
	}
	if (city.length > 100) {
		return { ok: false, message: 'Enter a shorter city.' };
	}
	if (!state) {
		return { ok: false, message: 'Enter a state.' };
	}
	if (state.length > 100) {
		return { ok: false, message: 'Enter a shorter state.' };
	}
	if (!referral) {
		return { ok: false, message: 'Select how you heard about us.' };
	}
	if (linkedinUrl && (!isHttpUrl(linkedinUrl) || linkedinUrl.length > 100)) {
		return { ok: false, message: linkedinUrl.length > 100 ? 'Enter a shorter LinkedIn URL.' : 'Enter a valid LinkedIn URL.' };
	}
	if (portfolioUrl && (!isHttpUrl(portfolioUrl) || portfolioUrl.length > 100)) {
		return { ok: false, message: portfolioUrl.length > 100 ? 'Enter a shorter portfolio URL.' : 'Enter a valid portfolio URL.' };
	}
	if (resume && resume.size > 0) {
		const message = resumeError(resume);
		if (message) {
			return { ok: false, message };
		}
	}
	if (!token || token.length > 2048) {
		return { ok: false, message: 'Security check failed. Please try again.' };
	}

	const body = new FormData();
	body.set('firstName', firstName);
	body.set('lastName', lastName);
	body.set('email', email);
	body.set('phone', phone);
	body.set('city', city);
	body.set('state', state);
	body.set('referral', referral);
	if (linkedinUrl) {
		body.set('linkedinUrl', linkedinUrl);
	}
	if (portfolioUrl) {
		body.set('portfolioUrl', portfolioUrl);
	}
	if (resume && resume.size > 0) {
		body.set('resume', resume);
	}
	body.set('cf-turnstile-response', token);
	return { ok: true, body };
}

export function resetTurnstile(form: HTMLFormElement): void {
	const input = form.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
	const widgetId = input?.id.match(/^cf-chl-widget-(.+)_response$/)?.[1];
	if (widgetId) {
		window.turnstile?.reset(widgetId);
		return;
	}

	window.turnstile?.reset();
}
