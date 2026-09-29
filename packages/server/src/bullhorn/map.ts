import { PUBLISHED_QUERY } from './fields';

export interface ListQuery {
	q?: string;
	location?: string;
	category?: string;
	start: number;
	count: number;
}

export interface JobSummary {
	id: number;
	title: string;
	location: string;
	employmentType: string;
	category: string;
	salary: number | null;
	salaryUnit: string;
	publishedAt: number | null;
}

export interface JobDetail extends JobSummary {
	description: string;
}

const LUCENE_SPECIAL = /[+\-!(){}[\]^"~*?:\\/&|]/g;

export function escapeLucene(value: string): string {
	return value.replace(LUCENE_SPECIAL, '\\$&');
}

export function publishedJobsQuery(query: Pick<ListQuery, 'q' | 'location' | 'category'>): string {
	const parts = [PUBLISHED_QUERY];
	const title = query.q?.trim();
	if (title) {
		parts.push(`title:${escapeLucene(title)}*`);
	}

	const location = query.location?.trim();
	if (location) {
		parts.push(`address.city:"${escapeLucene(location)}"`);
	}

	const category = query.category?.trim();
	if (category) {
		parts.push(`publishedCategory.name:"${escapeLucene(category)}"`);
	}

	return parts.join(' AND ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object';
}

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function flag(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

function salaryAmount(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) {
		return null;
	}

	return value;
}

export function publicHtml(value: string): string {
	return value
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
		.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
		.replace(/<embed\b[^>]*>/gi, '')
		.replace(/\s+on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '')
		.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
		.replace(/javascript:/gi, '');
}

export function formatLocation(address: unknown): string {
	if (!isRecord(address)) {
		return '';
	}

	return [text(address.city), text(address.state), text(address.countryName)].filter(Boolean).join(', ');
}

export function mapJob(value: unknown): JobDetail | null {
	if (!isRecord(value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id)) {
		return null;
	}

	if (!flag(value.isOpen) || !flag(value.isPublic) || flag(value.isDeleted)) {
		return null;
	}

	const title = text(value.title);
	if (!title) {
		return null;
	}

	const category = isRecord(value.publishedCategory) ? text(value.publishedCategory.name) : '';
	const publishedAt = typeof value.dateLastPublished === 'number' ? value.dateLastPublished : null;

	return {
		id: value.id,
		title,
		location: formatLocation(value.address),
		employmentType: text(value.employmentType),
		category,
		salary: salaryAmount(value.salary),
		salaryUnit: text(value.salaryUnit),
		publishedAt,
		description: publicHtml(text(value.publicDescription)),
	};
}
