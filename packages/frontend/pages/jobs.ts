import { fetchPublishedJobs, readApiOrigin } from '../shared/api';
import { divisionChipColor } from '../shared/divisions';
import { bindErrorCancel, showError } from '../shared/errors';
import { annualSalary, formatCardSalary, formatPostedDate, isNewJob, type JobSummary } from '../shared/jobs';

const LIST_SELECTOR = '[dev-target="jobs-list"]';
const CARD_SELECTOR = '[dev-target="job-card-item"]';
const QUERY_SELECTOR = '[dev-target="jobs-query"]';
const LOCATION_SELECTOR = '[dev-target="jobs-location"]';
const CATEGORY_SELECTOR = '[dev-target="jobs-category"]';
const SALARY_MIN_SELECTOR = '[dev-target="jobs-salary-min"]';
const SALARY_MAX_SELECTOR = '[dev-target="jobs-salary-max"]';
const RESULTS_SELECTOR = '[dev-target="results"], .results';

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

function takeCardTemplate(list: HTMLElement): HTMLElement | null {
	const card = list.querySelector<HTMLElement>(CARD_SELECTOR);
	if (!card) {
		return null;
	}

	const template = card.cloneNode(true) as HTMLElement;
	card.remove();
	return template;
}

function setShown(node: Element | null, shown: boolean): void {
	node?.classList.toggle('w-condition-invisible', !shown);
}

function setField(root: ParentNode, field: string, value: string): void {
	const node = root.querySelector<HTMLElement>(`[fs-cmsfilter-field="${field}"]`);
	if (node) {
		node.textContent = value;
	}
}

function fillSalary(root: ParentNode, job: JobSummary): void {
	const block = root.querySelector<HTMLElement>('.salary');
	const minAmount = job.salaryMin ?? null;
	const maxAmount = job.salaryMax ?? job.salary;
	const ranged = minAmount != null && maxAmount != null && minAmount !== maxAmount;
	const max = block?.querySelector<HTMLElement>('[fs-cmsfilter-field="salary"]') ?? null;
	const paragraphs = block ? [...block.querySelectorAll('p')] : [];
	const divider = paragraphs.find((paragraph) => paragraph.hasAttribute('salary-divider') || paragraph.textContent?.trim() === '-') ?? null;
	const min =
		paragraphs.find((paragraph) => paragraph !== max && paragraph !== divider && !paragraph.classList.contains('hidden-filter')) ?? null;

	if (max) {
		max.textContent = formatCardSalary(ranged ? maxAmount : (maxAmount ?? minAmount), job.salaryUnit);
	}
	if (min) {
		min.textContent = ranged ? formatCardSalary(minAmount, job.salaryUnit) : '';
	}
	setShown(min, ranged);
	setShown(divider, ranged);
	setShown(block, maxAmount != null || minAmount != null);
	setShown(root.querySelector('[dev-target="salary-max-pre-div"]'), maxAmount != null || minAmount != null);
}

function fillDivision(root: ParentNode, division: string): void {
	const chip = root.querySelector<HTMLElement>('[dev-target="division-chip"], .division-chip');
	if (!chip) {
		return;
	}

	const label = chip.querySelector('p');
	if (!division) {
		setShown(chip, false);
		return;
	}

	setShown(chip, true);
	if (label) {
		label.textContent = division;
	}
	const color = divisionChipColor(division);
	if (color) {
		chip.style.backgroundColor = color;
		return;
	}

	chip.style.removeProperty('background-color');
}

function fillRemote(root: ParentNode, remote: boolean): void {
	setShown(root.querySelector('[dev-target="remote-role"]'), remote);
	setShown(root.querySelector('[dev-target="remote-text"], p.remote'), remote);
	const value = root.querySelector<HTMLElement>('p.hidden-filter[fs-cmsfilter-field="remote"]');
	if (value) {
		value.textContent = remote ? 'Yes' : 'No';
	}
}

function fillCard(card: HTMLElement, job: JobSummary, href: string): void {
	if (card instanceof HTMLAnchorElement) {
		card.href = href;
	}

	setField(card, 'title', job.title);
	setField(card, 'location', job.location);
	setField(card, 'type', job.employmentType);
	setField(card, 'category', job.category);
	fillSalary(card, job);
	fillDivision(card, job.division?.trim() ?? '');
	fillRemote(card, job.remote === true);

	const posted = card.querySelector<HTMLElement>('[dev-target="date-posted"], .date-field-hidden');
	if (posted && job.publishedAt != null) {
		posted.textContent = formatPostedDate(job.publishedAt);
	}
	setShown(card.querySelector('.new-job-text'), isNewJob(job.publishedAt));

	const preview = card.querySelector<HTMLElement>('[fs-cmsfilter-field="preview"]');
	if (preview) {
		preview.textContent = '';
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

function resultsRoot(): HTMLElement | null {
	const marked = document.querySelector<HTMLElement>(RESULTS_SELECTOR);
	if (!marked) {
		return null;
	}

	if (marked.querySelector('[fs-cmsfilter-element="results-count"]')) {
		return marked;
	}

	const parent = marked.closest<HTMLElement>('.results');
	if (parent?.querySelector('[fs-cmsfilter-element="results-count"]')) {
		return parent;
	}

	return marked;
}

function fillResults(shown: number, total: number): void {
	const root = resultsRoot();
	if (!root) {
		return;
	}

	let shownNode = root.querySelector<HTMLElement>('[fs-cmsfilter-element="results-count"]');
	let totalNode = root.querySelector<HTMLElement>('[fs-cmsfilter-element="items-count"]');
	if (!shownNode || !totalNode) {
		const showing = document.createElement('div');
		showing.textContent = 'Showing';
		shownNode = document.createElement('div');
		shownNode.setAttribute('fs-cmsfilter-element', 'results-count');
		const resultsLabel = document.createElement('div');
		resultsLabel.textContent = 'Results';
		const of = document.createElement('div');
		of.textContent = 'of';
		totalNode = document.createElement('div');
		totalNode.setAttribute('fs-cmsfilter-element', 'items-count');
		root.replaceChildren(showing, shownNode, resultsLabel, of, totalNode);
	}

	shownNode.textContent = String(shown);
	totalNode.textContent = String(total);
}

function render(list: HTMLElement, template: HTMLElement, jobs: JobSummary[]): void {
	const visible = jobs.filter((job) => matches(job, readFilters()));
	fillResults(visible.length, jobs.length);
	list.replaceChildren();

	if (visible.length === 0) {
		const empty = document.createElement('p');
		empty.setAttribute('dev-target', 'jobs-empty');
		empty.textContent = 'No jobs match your search.';
		list.append(empty);
		return;
	}

	for (const job of visible) {
		const card = template.cloneNode(true) as HTMLElement;
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
	const template = takeCardTemplate(list);
	bindErrorCancel();
	if (!template) {
		showError('Job card is missing.');
	} else if (!readApiOrigin()) {
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
