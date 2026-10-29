import { z } from 'zod';

import { parseJobId } from './bullhorn/ids.js';
import type { ListQuery } from './bullhorn/map.js';

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

const RESUME_EXTENSIONS = new Set(['pdf', 'doc', 'docx']);

const listQuerySchema = z.object({
	q: z.string().trim().max(100).optional(),
	location: z.string().trim().max(80).optional(),
	category: z.string().trim().max(80).optional(),
	near: z.string().trim().max(80).optional(),
	start: z.coerce.number().int().min(0).max(10_000).default(0),
	count: z.coerce.number().int().min(1).max(200).default(50),
});

const optionalUrl = z
	.string()
	.trim()
	.max(100)
	.refine((value) => value === '' || isHttpUrl(value));

const applicationSchema = z.object({
	firstName: z.string().trim().min(1).max(50),
	lastName: z.string().trim().min(1).max(50),
	email: z.string().trim().max(100).email(),
	phone: z.string().trim().min(1).max(50),
	city: z.string().trim().min(1).max(100),
	state: z.string().trim().min(1).max(100),
	linkedinUrl: optionalUrl,
	portfolioUrl: optionalUrl,
});

export interface ApplicationInput {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	city: string;
	state: string;
	linkedinUrl: string;
	portfolioUrl: string;
}

export interface ResumeFile {
	name: string;
	mediaType: string;
	bytes: Uint8Array;
}

export interface ParsedApplication extends ApplicationInput {
	resume: ResumeFile;
}

function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function tooLong(issue: { code: string }): boolean {
	return issue.code === 'too_big';
}

const FIELD_LABELS: Record<string, string> = {
	firstName: 'first name',
	lastName: 'last name',
	email: 'email address',
	phone: 'phone number',
	city: 'city',
	state: 'state',
	linkedinUrl: 'LinkedIn URL',
	portfolioUrl: 'portfolio URL',
};

function issueMessage(error: z.ZodError, fallback: string): string {
	const issue = error.issues[0];
	if (!issue) {
		return fallback;
	}

	const field = issue.path[0];
	if (field === 'email') {
		return 'Enter a valid email address.';
	}
	if (field === 'firstName') {
		return tooLong(issue) ? 'Enter a shorter first name.' : 'Enter a first name.';
	}
	if (field === 'lastName') {
		return tooLong(issue) ? 'Enter a shorter last name.' : 'Enter a last name.';
	}
	if (field === 'phone') {
		return tooLong(issue) ? 'Enter a shorter phone number.' : 'Enter a phone number.';
	}
	if (field === 'city') {
		return tooLong(issue) ? 'Enter a shorter city.' : 'Enter a city.';
	}
	if (field === 'state') {
		return tooLong(issue) ? 'Enter a shorter state.' : 'Enter a state.';
	}
	if (field === 'linkedinUrl') {
		return tooLong(issue) ? 'Enter a shorter LinkedIn URL.' : 'Enter a valid LinkedIn URL.';
	}
	if (field === 'portfolioUrl') {
		return tooLong(issue) ? 'Enter a shorter portfolio URL.' : 'Enter a valid portfolio URL.';
	}
	if (field === 'q' || field === 'location' || field === 'category' || field === 'near' || field === 'start' || field === 'count') {
		return 'Those filters are not valid.';
	}

	const label = FIELD_LABELS[String(field)] ?? '';
	if (label && tooLong(issue)) {
		return `Enter a shorter ${label}.`;
	}
	if (label) {
		return `Enter a valid ${label}.`;
	}

	return fallback;
}

export function parseListQuery(query: Record<string, string | undefined>): { ok: true; value: ListQuery } | { ok: false; message: string } {
	const parsed = listQuerySchema.safeParse({
		q: query.q || undefined,
		location: query.location || undefined,
		category: query.category || undefined,
		near: query.near || undefined,
		start: query.start ?? 0,
		count: query.count ?? 50,
	});

	if (!parsed.success) {
		return { ok: false, message: issueMessage(parsed.error, 'Those filters are not valid.') };
	}

	const { q, location, category, near, start, count } = parsed.data;
	return {
		ok: true,
		value: {
			q: q || undefined,
			location: location || undefined,
			category: category || undefined,
			near: near || undefined,
			start,
			count,
		},
	};
}

export function parseJobParam(value: string): number | null {
	return parseJobId(value);
}

function fieldText(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function resumeExtension(name: string): string {
	const base = name.split(/[/\\]/).pop() ?? '';
	const extension = base.split('.').pop()?.toLowerCase() ?? '';
	return extension;
}

function safeFileName(name: string): string {
	const base =
		name
			.split(/[/\\]/)
			.pop()
			?.replace(/[^\w.\- ]+/g, '') || 'resume';
	return base.slice(0, 120) || 'resume';
}

function mediaTypeFor(extension: string): string {
	if (extension === 'pdf') {
		return 'application/pdf';
	}
	if (extension === 'doc') {
		return 'application/msword';
	}

	return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

export async function parseApplication(
	body: Record<string, unknown>,
): Promise<{ ok: true; value: ParsedApplication } | { ok: false; message: string }> {
	const parsed = applicationSchema.safeParse({
		firstName: fieldText(body.firstName),
		lastName: fieldText(body.lastName),
		email: fieldText(body.email),
		phone: fieldText(body.phone),
		city: fieldText(body.city),
		state: fieldText(body.state),
		linkedinUrl: fieldText(body.linkedinUrl),
		portfolioUrl: fieldText(body.portfolioUrl),
	});

	if (!parsed.success) {
		return { ok: false, message: issueMessage(parsed.error, 'A required field is missing or not valid.') };
	}

	const resume = await parseResume(body.resume);
	if (!resume.ok) {
		return resume;
	}

	return {
		ok: true,
		value: {
			firstName: parsed.data.firstName,
			lastName: parsed.data.lastName,
			email: parsed.data.email.toLowerCase(),
			phone: parsed.data.phone,
			city: parsed.data.city,
			state: parsed.data.state,
			linkedinUrl: parsed.data.linkedinUrl,
			portfolioUrl: parsed.data.portfolioUrl,
			resume: resume.file,
		},
	};
}

async function parseResume(value: unknown): Promise<{ ok: true; file: ResumeFile } | { ok: false; message: string }> {
	if (!(value instanceof File) || value.size === 0) {
		return { ok: false, message: 'Attach a resume.' };
	}

	if (value.size > MAX_RESUME_BYTES) {
		return { ok: false, message: 'Resume must be 10 MB or smaller.' };
	}

	const extension = resumeExtension(value.name);
	if (!RESUME_EXTENSIONS.has(extension)) {
		return { ok: false, message: 'Resume must be a PDF, DOC, or DOCX file.' };
	}

	const bytes = new Uint8Array(await value.arrayBuffer());
	return {
		ok: true,
		file: {
			name: safeFileName(value.name),
			mediaType: mediaTypeFor(extension),
			bytes,
		},
	};
}
