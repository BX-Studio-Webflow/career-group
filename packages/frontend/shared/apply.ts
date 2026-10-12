export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

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
		return 'Resume must be 10 MB or smaller.';
	}

	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (!RESUME_EXTENSIONS.has(extension)) {
		return 'Resume must be a PDF, DOC, or DOCX file.';
	}

	return null;
}

export interface ApplyFailure {
	ok: false;
	message: string;
	targets: string[];
}

const MESSAGE_TARGETS: [string, string][] = [
	['first name', 'first-name'],
	['last name', 'last-name'],
	['email', 'email'],
	['phone', 'phone'],
	['city', 'city'],
	['state', 'state'],
	['heard about', 'referral'],
	['linkedin', 'linkedin-url'],
	['portfolio', 'porfolio'],
	['resume', 'file-upload'],
];

function fieldError(target: string, message: string): { target: string; message: string } {
	return { target, message };
}

function textError(
	target: string,
	text: string,
	emptyMessage: string,
	limit: number,
	longMessage: string,
): { target: string; message: string } | null {
	if (!text) {
		return fieldError(target, emptyMessage);
	}
	if (text.length > limit) {
		return fieldError(target, longMessage);
	}
	return null;
}

function urlError(target: string, url: string, longMessage: string, invalidMessage: string): { target: string; message: string } | null {
	if (!url) {
		return null;
	}
	if (url.length > 100) {
		return fieldError(target, longMessage);
	}
	if (!isHttpUrl(url)) {
		return fieldError(target, invalidMessage);
	}
	return null;
}

export function fieldErrors(form: HTMLFormElement): { target: string; message: string }[] {
	const resume = form.querySelector<HTMLInputElement>('[dev-target="file-upload"]')?.files?.[0];
	const resumeMessage = !resume || resume.size === 0 ? 'Attach a resume.' : resumeError(resume);
	return [
		textError('first-name', value(form, 'first-name'), 'Enter a first name.', 50, 'Enter a shorter first name.'),
		textError('last-name', value(form, 'last-name'), 'Enter a last name.', 50, 'Enter a shorter last name.'),
		isEmail(value(form, 'email')) ? null : fieldError('email', 'Enter a valid email address.'),
		textError('phone', value(form, 'phone'), 'Enter a phone number.', 50, 'Enter a shorter phone number.'),
		textError('city', value(form, 'city'), 'Enter a city.', 100, 'Enter a shorter city.'),
		textError('state', value(form, 'state'), 'Enter a state.', 100, 'Enter a shorter state.'),
		value(form, 'referral') ? null : fieldError('referral', 'Select how you heard about us.'),
		urlError('linkedin-url', value(form, 'linkedin-url'), 'Enter a shorter LinkedIn URL.', 'Enter a valid LinkedIn URL.'),
		urlError('porfolio', value(form, 'porfolio'), 'Enter a shorter portfolio URL.', 'Enter a valid portfolio URL.'),
		resumeMessage ? fieldError('file-upload', resumeMessage) : null,
	].filter((error): error is { target: string; message: string } => error !== null);
}

export function targetForMessage(message: string): string | null {
	const text = message.toLowerCase();
	return MESSAGE_TARGETS.find(([needle]) => text.includes(needle))?.[1] ?? null;
}

export function applicationFormData(form: HTMLFormElement): { ok: true; body: FormData } | ApplyFailure {
	const errors = fieldErrors(form);
	if (errors.length > 0) {
		return {
			ok: false,
			message: errors[0]?.message ?? 'Check the application fields and try again.',
			targets: errors.map((error) => error.target).filter(Boolean),
		};
	}

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
	return { ok: true, body };
}

export function clearFieldErrors(form: HTMLFormElement): void {
	form.querySelectorAll<HTMLElement>('.is-error').forEach((field) => {
		field.classList.remove('is-error');
	});
}

export function markFieldErrors(form: HTMLFormElement, targets: string[]): void {
	clearFieldErrors(form);
	for (const target of targets) {
		form.querySelector<HTMLElement>(`[dev-target="${target}"]`)?.classList.add('is-error');
	}
}
