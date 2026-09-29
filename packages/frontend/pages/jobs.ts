import { fetchPublishedJobs, readApiOrigin } from '../shared/api';
import { bindErrorCancel, showError } from '../shared/errors';
import { annualSalary, formatSalary, type JobSummary } from '../shared/jobs';

const LIST_SELECTOR = '[dev-target="jobs-list"]';
const TEMPLATE_SELECTOR = '[dev-target="job-card-template"]';
const QUERY_SELECTOR = '[dev-target="jobs-query"]';
const LOCATION_SELECTOR = '[dev-target="jobs-location"]';
const CATEGORY_SELECTOR = '[dev-target="jobs-category"]';
const SALARY_MIN_SELECTOR = '[dev-target="jobs-salary-min"]';
const SALARY_MAX_SELECTOR = '[dev-target="jobs-salary-max"]';

interface Filters {
	q: string;
	location: string;
	category: string;
	min: number | null;
	max: number | null;
}

function readText(selector: string): string {
	const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(selector);
	return field?.value.trim() ?? '';
}

function readNumber(selector: string): number | null {
	const value = readText(selector).replace(/[$,]/g, '');
	if (!value) {
		return null;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return null;
	}

	return parsed;
}

function readFilters(): Filters {
	return {
		q: readText(QUERY_SELECTOR),
		location: readText(LOCATION_SELECTOR),
		category: readText(CATEGORY_SELECTOR),
		min: readNumber(SALARY_MIN_SELECTOR),
		max: readNumber(SALARY_MAX_SELECTOR),
	};
}

function matches(job: JobSummary, filters: Filters): boolean {
	if (filters.q && !job.title.toLowerCase().includes(filters.q.toLowerCase())) {
		return false;
	}
	if (filters.location && !job.location.toLowerCase().includes(filters.location.toLowerCase())) {
		return false;
	}
	if (filters.category && job.category.toLowerCase() !== filters.category.toLowerCase()) {
		return false;
	}

	if (filters.min == null && filters.max == null) {
		return true;
	}

	const annual = annualSalary(job);
	if (annual == null) {
		return false;
	}
	if (filters.min != null && annual < filters.min) {
		return false;
	}
	if (filters.max != null && annual > filters.max) {
		return false;
	}

	return true;
}

function detailHref(list: HTMLElement, id: number): string {
	const path = list.getAttribute('detail-path')?.trim() || window.location.pathname;
	const url = new URL(path, window.location.origin);
	url.searchParams.set('id', String(id));
	return `${url.pathname}${url.search}`;
}

function defaultCard(): HTMLAnchorElement {
	const link = document.createElement('a');
	link.setAttribute('dev-target', 'job-link');

	for (const [target, tag] of [
		['job-title', 'h3'],
		['job-location', 'p'],
		['job-category', 'p'],
		['job-type', 'p'],
		['job-salary', 'p'],
	] as const) {
		const node = document.createElement(tag);
		node.setAttribute('dev-target', target);
		link.append(node);
	}

	return link;
}

function cloneCard(template: HTMLTemplateElement | HTMLElement | null): ParentNode {
	if (template instanceof HTMLTemplateElement) {
		return template.content.cloneNode(true) as DocumentFragment;
	}

	if (template) {
		const clone = template.cloneNode(true) as HTMLElement;
		clone.removeAttribute('dev-target');
		clone.classList.remove('hide');
		clone.hidden = false;
		return clone;
	}

	return defaultCard();
}

function setText(root: ParentNode, target: string, value: string): void {
	const node = root.querySelector<HTMLElement>(`[dev-target="${target}"]`);
	if (node) {
		node.textContent = value;
	}
}

function fillCard(root: ParentNode, job: JobSummary, href: string): void {
	setText(root, 'job-title', job.title);
	setText(root, 'job-location', job.location);
	setText(root, 'job-category', job.category);
	setText(root, 'job-type', job.employmentType);
	setText(root, 'job-salary', formatSalary(job.salary, job.salaryUnit));

	const link = root.querySelector<HTMLAnchorElement>('[dev-target="job-link"]') ?? root.querySelector<HTMLAnchorElement>('a');
	if (link) {
		link.href = href;
	}
}

function fillCategories(jobs: JobSummary[]): void {
	const select = document.querySelector<HTMLSelectElement>('select[dev-target="jobs-category"]');
	if (!select || select.options.length > 1) {
		return;
	}

	const names = [...new Set(jobs.map((job) => job.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));
	for (const name of names) {
		const option = document.createElement('option');
		option.value = name;
		option.textContent = name;
		select.append(option);
	}
}

function render(list: HTMLElement, template: HTMLTemplateElement | HTMLElement | null, jobs: JobSummary[]): void {
	const visible = jobs.filter((job) => matches(job, readFilters()));
	list.replaceChildren();

	if (visible.length === 0) {
		const empty = document.createElement('p');
		empty.setAttribute('dev-target', 'jobs-empty');
		empty.textContent = 'No jobs match your search.';
		list.append(empty);
		return;
	}

	for (const job of visible) {
		const card = cloneCard(template);
		fillCard(card, job, detailHref(list, job.id));
		list.append(card);
	}
}

function bindFilters(onChange: () => void): void {
	const selectors = [QUERY_SELECTOR, LOCATION_SELECTOR, CATEGORY_SELECTOR, SALARY_MIN_SELECTOR, SALARY_MAX_SELECTOR];
	for (const selector of selectors) {
		document.querySelector(selector)?.addEventListener('input', onChange);
		document.querySelector(selector)?.addEventListener('change', onChange);
	}
}

const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
if (list) {
	const template = document.querySelector<HTMLTemplateElement | HTMLElement>(TEMPLATE_SELECTOR);
	bindErrorCancel();

	if (!readApiOrigin()) {
		showError('Careers API is not configured.');
	} else {
		let loaded: JobSummary[] = [];
		let pending = 0;
		const schedule = () => {
			window.clearTimeout(pending);
			pending = window.setTimeout(() => render(list, template, loaded), 150);
		};
		list.textContent = 'Loading jobs…';
		bindFilters(schedule);

		void fetchPublishedJobs()
			.then((jobs) => {
				loaded = jobs;
				fillCategories(jobs);
				render(list, template, jobs);
			})
			.catch((error: unknown) => {
				console.error('[Careers] Job list failed', error);
				list.textContent = '';
				showError('Jobs could not be loaded. Please try again.');
			});
	}
}
