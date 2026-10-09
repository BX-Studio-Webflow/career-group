export interface JobSummary {
	id: number;
	title: string;
	location: string;
	employmentType: string;
	category: string;
	salary: number | null;
	salaryMin?: number | null;
	salaryMax?: number | null;
	salaryUnit: string;
	publishedAt: number | null;
	division?: string;
	remote?: boolean;
	worksite?: string;
	preview?: string;
}

export interface JobDetail extends JobSummary {
	description: string;
}

export function formatSalary(salary: number | null, unit: string): string {
	if (salary == null) {
		return '';
	}

	const amount = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0,
	}).format(salary);

	return unit ? `${amount} ${unit}` : amount;
}

export function formatSalaryRange(job: Pick<JobSummary, 'salary' | 'salaryMin' | 'salaryMax' | 'salaryUnit'>): string {
	const min = job.salaryMin ?? null;
	const max = job.salaryMax ?? job.salary;
	if (min != null && max != null && min !== max) {
		return `${formatCardSalary(min, job.salaryUnit)}–${formatCardSalary(max, job.salaryUnit)}`;
	}

	return formatCardSalary(max ?? min, job.salaryUnit);
}

export function formatCardSalary(salary: number | null, unit: string): string {
	if (salary == null) {
		return '';
	}

	const amount = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: salary % 1 === 0 ? 0 : 2,
	}).format(salary);
	const normalized = unit.toLowerCase();
	if (normalized.includes('hour')) {
		return `${amount}/hr`;
	}

	return amount;
}

const NEW_JOB_DAYS = 4;

export function isNewJob(publishedAt: number | null, now = Date.now()): boolean {
	if (publishedAt == null) {
		return false;
	}

	const cutoff = new Date(now);
	cutoff.setHours(0, 0, 0, 0);
	cutoff.setDate(cutoff.getDate() - NEW_JOB_DAYS);
	return publishedAt >= cutoff.getTime();
}

export function formatPostedDate(publishedAt: number): string {
	const date = new Date(publishedAt);
	const year = String(date.getFullYear()).slice(-2);
	return `${date.getDate()}.${date.getMonth() + 1}.${year}`;
}

export function annualSalary(job: JobSummary): number | null {
	if (job.salary == null) {
		return null;
	}

	const unit = job.salaryUnit.toLowerCase();
	if (unit.includes('hour')) {
		return job.salary * 2080;
	}
	if (unit.includes('day')) {
		return job.salary * 260;
	}
	if (unit.includes('week')) {
		return job.salary * 52;
	}
	if (unit.includes('month')) {
		return job.salary * 12;
	}

	return job.salary;
}
