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
