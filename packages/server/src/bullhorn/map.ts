import { PUBLISHED_QUERY } from './fields.js';

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
	salaryMin: number | null;
	salaryMax: number | null;
	salaryUnit: string;
	publishedAt: number | null;
	division: string;
	remote: boolean;
	worksite: string;
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
		parts.push(`customText5:"${escapeLucene(category)}"`);
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
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return null;
	}

	return value;
}

function hidesSalary(value: unknown): boolean {
	return text(value).toLowerCase() === 'yes';
}

function worksiteName(value: unknown): string {
	const raw = text(value).toLowerCase();
	if (raw.startsWith('remote')) {
		return 'Remote';
	}
	if (raw.startsWith('hybrid')) {
		return 'Hybrid';
	}
	if (raw.startsWith('onsite') || raw.startsWith('on-site') || raw.startsWith('on site')) {
		return 'Onsite';
	}

	return '';
}

const STATE_ABBREVIATIONS: Record<string, string> = {
	alabama: 'AL',
	alaska: 'AK',
	arizona: 'AZ',
	arkansas: 'AR',
	california: 'CA',
	colorado: 'CO',
	connecticut: 'CT',
	delaware: 'DE',
	'district of columbia': 'DC',
	florida: 'FL',
	georgia: 'GA',
	hawaii: 'HI',
	idaho: 'ID',
	illinois: 'IL',
	indiana: 'IN',
	iowa: 'IA',
	kansas: 'KS',
	kentucky: 'KY',
	louisiana: 'LA',
	maine: 'ME',
	maryland: 'MD',
	massachusetts: 'MA',
	michigan: 'MI',
	minnesota: 'MN',
	mississippi: 'MS',
	missouri: 'MO',
	montana: 'MT',
	nebraska: 'NE',
	nevada: 'NV',
	'new hampshire': 'NH',
	'new jersey': 'NJ',
	'new mexico': 'NM',
	'new york': 'NY',
	'north carolina': 'NC',
	'north dakota': 'ND',
	ohio: 'OH',
	oklahoma: 'OK',
	oregon: 'OR',
	pennsylvania: 'PA',
	'rhode island': 'RI',
	'south carolina': 'SC',
	'south dakota': 'SD',
	tennessee: 'TN',
	texas: 'TX',
	utah: 'UT',
	vermont: 'VT',
	virginia: 'VA',
	washington: 'WA',
	'west virginia': 'WV',
	wisconsin: 'WI',
	wyoming: 'WY',
};

function stateAbbreviation(value: string): string {
	if (/^[A-Za-z]{2}$/.test(value)) {
		return value.toUpperCase();
	}

	return STATE_ABBREVIATIONS[value.toLowerCase()] ?? value;
}

function isUnitedStates(value: string): boolean {
	return /^(united states|united states of america|usa|u\.s\.a\.|u\.s\.|us)$/i.test(value);
}

const DIVISION_NAMES: Record<string, string> = {
	cg: 'Career Group',
	sb: 'Syndicatebleu',
	ff: 'Fourth Floor',
	cgs: 'Career Group Search',
	cgc: 'CGC Internal',
	event: 'Career Group Events',
	events: 'Career Group Events',
};

function divisionName(value: unknown): string {
	const code = text(value);
	if (!code) {
		return '';
	}

	return DIVISION_NAMES[code.toLowerCase()] ?? code;
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

	const city = text(address.city);
	const state = stateAbbreviation(text(address.state));
	const country = text(address.countryName);
	if (!country || isUnitedStates(country)) {
		return [city, state].filter(Boolean).join(', ');
	}

	return [city, state, country].filter(Boolean).join(', ');
}

export function mapJob(value: unknown): JobDetail | null {
	if (!isRecord(value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id)) {
		return null;
	}

	if (!flag(value.isPublic) || flag(value.isDeleted)) {
		return null;
	}

	const title = text(value.customText15) || text(value.title);
	if (!title) {
		return null;
	}

	const publishedCategory = isRecord(value.publishedCategory) ? text(value.publishedCategory.name) : '';
	const category = text(value.customText5) || publishedCategory;
	const worksite = worksiteName(value.customText10);
	const publishedAt =
		typeof value.customDate1 === 'number'
			? value.customDate1
			: typeof value.dateLastPublished === 'number'
				? value.dateLastPublished
				: null;
	const hidden = hidesSalary(value.customText12);
	let salaryMin = hidden ? null : salaryAmount(value.customFloat1);
	let salaryMax = hidden ? null : salaryAmount(value.customFloat2);
	let salaryUnit = text(value.salaryUnit);
	if (!hidden && salaryMin == null && salaryMax == null) {
		const hourlyMin = salaryAmount(value.payRate);
		const hourlyMax = salaryAmount(value.customFloat3);
		if (hourlyMin != null || hourlyMax != null) {
			salaryMin = hourlyMin;
			salaryMax = hourlyMax;
			salaryUnit = 'hour';
		}
	}
	const salary = salaryMax ?? salaryMin ?? (hidden ? null : salaryAmount(value.salary));

	return {
		id: value.id,
		title,
		location: formatLocation(value.address),
		employmentType: text(value.employmentType),
		category,
		salary,
		salaryMin,
		salaryMax,
		salaryUnit,
		publishedAt,
		division: divisionName(value.customText20),
		remote: worksite === 'Remote',
		worksite,
		description: publicHtml(text(value.publicDescription)),
	};
}
