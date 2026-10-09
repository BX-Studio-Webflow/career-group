export interface FilterChoice {
	label: string;
	value: string;
}

const DIVISION_LABELS = ['Career Group', 'Syndicatebleu', 'Fourth Floor', 'Career Group Search', 'Career Group Events', 'CGC Internal'];

const JOB_FUNCTION_LABELS = [
	'Administrative-Office',
	'Art-Creative',
	'Branding',
	'Business Development',
	'Creative',
	'Customer Service',
	'Design',
	'Desk',
	'Entertainment',
	'Fashion/Beauty',
	'Finance',
	'Human Resources and Recruiting',
	'Legal-Paralegal',
	'Management',
	'Marketing',
	'Merchandising',
	'Nonprofit',
	'Other Area(s)',
	'Product Management',
	'Project Management',
	'Public Relations',
	'Retail',
	'Social Media',
	'Supply Chain',
	'TV and Media',
	'Writing-Editing',
];

const SALARY_FLOORS = [40_000, 60_000, 80_000, 100_000, 120_000, 140_000, 160_000, 180_000, 200_000];

const EMPLOYMENT_VALUES: Record<string, string[]> = {
	'Direct Hire': ['direct hire', 'permanent'],
	'Temp to Hire': ['temp to hire', 'contract to hire'],
	Temp: ['temp', 'temporary', 'contract'],
};

const loggedOptions = new Set<string>();

function choice(label: string): FilterChoice {
	return { label, value: label };
}

export const DIVISION_OPTIONS = DIVISION_LABELS.map(choice);
export const EMPLOYMENT_OPTIONS = Object.keys(EMPLOYMENT_VALUES).map(choice);
export const JOB_FUNCTION_OPTIONS = JOB_FUNCTION_LABELS.map(choice);
export const SALARY_OPTIONS: FilterChoice[] = SALARY_FLOORS.map((amount) => ({
	label: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount),
	value: String(amount),
}));

export function matchesEmployment(jobType: string, selected: string[]): boolean {
	if (selected.length === 0) {
		return true;
	}

	const normalized = normalize(jobType);
	return selected.some((label) => {
		const values = EMPLOYMENT_VALUES[label];
		if (!values) {
			logOption(`Unknown employment type option: ${label}`);
			return false;
		}

		return values.includes(normalized);
	});
}

export function matchesChoice(value: string, selected: string[]): boolean {
	if (selected.length === 0) {
		return true;
	}

	const normalized = value.trim().toLowerCase();
	return selected.some((label) => label.trim().toLowerCase() === normalized);
}

function normalize(value: string): string {
	return value.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

function logOption(message: string): void {
	if (loggedOptions.has(message)) {
		return;
	}

	loggedOptions.add(message);
	console.error(`[job.ts] ${message}`);
}
