import { fetchJobsNear, fetchPublishedJobs, readApiOrigin } from '../shared/api';
import { divisionChipColor } from '../shared/divisions';
import { bindErrorCancel, showError } from '../shared/errors';
import {
	DIVISION_OPTIONS,
	EMPLOYMENT_OPTIONS,
	type FilterChoice,
	JOB_FUNCTION_OPTIONS,
	matchesChoice,
	matchesEmployment,
	SALARY_OPTIONS,
} from '../shared/filters';
import { annualSalary, formatCardSalary, formatPostedDate, isNewJob, type JobSummary } from '../shared/jobs';

const LIST_SELECTOR = '[dev-target="jobs-list"]';
const CARD_SELECTOR = '[dev-target="job-card-item"]';
const QUERY_SELECTOR = '[dev-target="jobs-query"]';
const SEARCH_SELECTOR = '[dev-target="search-input"]';
const LOCATION_SELECTOR = '[fs-combobox-element="text-input"], [dev-target="jobs-location"]';
const CATEGORY_SELECTOR = '[dev-target="jobs-category"]';
const SALARY_MIN_SELECTOR = '[dev-target="jobs-salary-min"]';
const SALARY_MAX_SELECTOR = '[dev-target="jobs-salary-max"]';
const RESULTS_SELECTOR = '[dev-target="results"], .results';
const DIVISION_SELECTOR = '[dev-target="division-checkbox-wrapper"]';
const REMOTE_SELECTOR = '[dev-target="remote-only-checkbox-wrapper"]';
const EMPLOYMENT_SELECTOR = '[dev-target="employment-type-checkbox-wrapper"]';
const SALARY_SELECTOR = '[dev-target="salary-radio-wrapper"]';
const FUNCTION_SELECTOR = '[dev-target="job-function-checkbox-wrapper"]';
const CLEAR_SELECTOR = '[dev-target="clear"]';
const LOCATION_MESSAGE = "We couldn't find that location. Try a city and state.";

interface Filters {
	q: string;
	divisions: string[];
	remoteOnly: boolean;
	employmentTypes: string[];
	categories: string[];
	min: number | null;
	max: number | null;
}

let divisionInputs: HTMLInputElement[] = [];
let employmentInputs: HTMLInputElement[] = [];
let salaryInputs: HTMLInputElement[] = [];
let functionInputs: HTMLInputElement[] = [];

function logEarly(message: string): void {
	console.error(`[job.ts] ${message}`);
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

function readSearch(): string {
	const marked = document.querySelector<HTMLInputElement>(SEARCH_SELECTOR);
	const field = marked ?? document.querySelector<HTMLInputElement>(QUERY_SELECTOR);
	return field?.value.trim() ?? '';
}

function readLocation(): string {
	return document.querySelector<HTMLInputElement>(LOCATION_SELECTOR)?.value.trim() ?? '';
}

function checkedValues(inputs: HTMLInputElement[]): string[] {
	return inputs.filter((input) => input.checked).map((input) => input.value);
}

function readSalary(): { min: number | null; max: number | null } {
	if (salaryInputs.length === 0) {
		return { min: readNumber(SALARY_MIN_SELECTOR), max: readNumber(SALARY_MAX_SELECTOR) };
	}

	const selected = salaryInputs.find((input) => input.checked);
	if (!selected) {
		return { min: null, max: null };
	}

	const min = Number(selected.value);
	if (!Number.isFinite(min)) {
		logEarly(`Salary option "${selected.value}" is not a number.`);
		return { min: null, max: null };
	}

	return { min, max: null };
}

function readCategories(): string[] {
	if (functionInputs.length > 0) {
		return checkedValues(functionInputs);
	}

	const category = readText(CATEGORY_SELECTOR);
	return category ? [category] : [];
}

function readFilters(): Filters {
	const salary = readSalary();
	return {
		q: readSearch(),
		divisions: checkedValues(divisionInputs),
		remoteOnly: document.querySelector<HTMLInputElement>(`${REMOTE_SELECTOR} input`)?.checked ?? false,
		employmentTypes: checkedValues(employmentInputs),
		categories: readCategories(),
		min: salary.min,
		max: salary.max,
	};
}

function matches(job: JobSummary, filters: Filters): boolean {
	if (filters.q) {
		const query = filters.q.toLowerCase();
		const haystack = `${job.title} ${job.location}`.toLowerCase();
		if (!haystack.includes(query)) {
			return false;
		}
	}
	if (!matchesChoice(job.division ?? '', filters.divisions)) {
		return false;
	}
	if (filters.remoteOnly && !job.remote) {
		return false;
	}
	if (!matchesEmployment(job.employmentType, filters.employmentTypes)) {
		return false;
	}
	if (!matchesChoice(job.category, filters.categories)) {
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

function optionId(group: string, label: string): string {
	const slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${group}-${slug}`;
}

function fillChoices(selector: string, options: FilterChoice[], group: string): HTMLInputElement[] {
	const template = document.querySelector<HTMLElement>(selector);
	if (!template) {
		logEarly(`${group} option template is missing.`);
		return [];
	}

	const parent = template.parentElement;
	if (!parent) {
		logEarly(`${group} option template has no parent.`);
		return [];
	}
	if (options.length === 0) {
		logEarly(`${group} has no options.`);
		template.remove();
		return [];
	}

	const inputs: HTMLInputElement[] = [];
	for (const option of options) {
		const node = template.cloneNode(true) as HTMLElement;
		node.removeAttribute('dev-target');
		const input = node.querySelector<HTMLInputElement>('input');
		const label = node.querySelector<HTMLElement>('.form_checkbox-label, .form_radio-label');
		if (!input || !label) {
			logEarly(`${group} option "${option.label}" is missing an input or label.`);
			continue;
		}

		const id = optionId(group, option.label);
		input.id = id;
		input.name = group;
		input.value = option.value;
		input.checked = false;
		label.textContent = option.label;
		label.setAttribute('for', id);
		node.querySelector('.w-checkbox-input, .w-radio-input')?.classList.remove('w--redirected-checked');
		parent.append(node);
		inputs.push(input);
	}

	template.remove();
	return inputs;
}

function syncInput(input: HTMLInputElement): void {
	const root = input.closest('label');
	if (!(root instanceof HTMLElement)) {
		logEarly('Filter option is missing its label.');
		return;
	}

	root.querySelector('.w-checkbox-input, .w-radio-input')?.classList.toggle('w--redirected-checked', input.checked);
}

function syncInputs(inputs: HTMLInputElement[]): void {
	for (const input of inputs) {
		syncInput(input);
	}
}

function locationMessageNode(list: HTMLElement): HTMLElement {
	const existing = document.querySelector<HTMLElement>('[dev-target="jobs-location-error"]');
	if (existing) {
		return existing;
	}

	const node = document.createElement('p');
	node.setAttribute('dev-target', 'jobs-location-error');
	list.before(node);
	return node;
}

function detailHref(list: HTMLElement, id: number): string {
	const path = list.getAttribute('detail-path')?.trim() || '/dev/job-posting-dev';
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

function setWorksiteLabel(node: HTMLElement, label: string): void {
	const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
	let current = walker.nextNode();
	while (current) {
		if (current.textContent?.trim()) {
			current.textContent = label;
			return;
		}
		current = walker.nextNode();
	}

	node.textContent = label;
}

function fillWorksite(root: ParentNode, worksite: string): void {
	const shown = worksite === 'Remote' || worksite === 'Hybrid';
	setShown(root.querySelector('[dev-target="remote-role"]'), shown);
	const text = root.querySelector<HTMLElement>('[dev-target="remote-text"], p.remote');
	if (text) {
		if (shown) {
			setWorksiteLabel(text, worksite);
		}
		setShown(text, shown);
	}
	const value = root.querySelector<HTMLElement>('p.hidden-filter[fs-cmsfilter-field="remote"]');
	if (value) {
		value.textContent = worksite === 'Remote' ? 'Yes' : worksite === 'Hybrid' ? 'Hybrid' : 'No';
	}
}

function fillCard(card: HTMLElement, job: JobSummary, href: string): void {
	const links = card instanceof HTMLAnchorElement ? [card, ...card.querySelectorAll('a')] : [...card.querySelectorAll('a')];
	for (const link of links) {
		link.href = href;
	}
	if (links.length === 0) {
		card.addEventListener('click', () => {
			window.location.assign(href);
		});
	}

	setField(card, 'title', job.title);
	setField(card, 'location', job.location);
	setField(card, 'type', job.employmentType);
	setField(card, 'category', job.category);
	fillSalary(card, job);
	fillDivision(card, job.division?.trim() ?? '');
	fillWorksite(card, job.worksite?.trim() || (job.remote ? 'Remote' : ''));

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

function bindChoice(inputs: HTMLInputElement[], onChange: () => void): void {
	for (const input of inputs) {
		input.addEventListener('change', () => {
			syncInputs(inputs);
			onChange();
		});
	}
}

function bindFilters(onChange: () => void, onLocation: () => void, onClear: () => void): void {
	const search = document.querySelector(SEARCH_SELECTOR) ?? document.querySelector(QUERY_SELECTOR);
	search?.addEventListener('input', onChange);
	bindChoice(divisionInputs, onChange);
	bindChoice(employmentInputs, onChange);
	bindChoice(functionInputs, onChange);
	bindChoice(salaryInputs, onChange);

	const remote = document.querySelector<HTMLInputElement>(`${REMOTE_SELECTOR} input`);
	remote?.addEventListener('change', () => {
		syncInput(remote);
		onChange();
	});

	const location = document.querySelector(LOCATION_SELECTOR);
	location?.addEventListener('input', onLocation);
	location?.addEventListener('change', onLocation);
	document.querySelector('#Locations')?.addEventListener('change', () => {
		const select = document.querySelector<HTMLSelectElement>('#Locations');
		const input = document.querySelector<HTMLInputElement>(LOCATION_SELECTOR);
		const selected = [...(select?.selectedOptions ?? [])]
			.map((option) => option.textContent?.trim() ?? '')
			.find((label) => label.length > 0);
		if (input && selected && input.value.trim() !== selected) {
			input.value = selected;
		}
		onLocation();
	});

	document.querySelector(CLEAR_SELECTOR)?.addEventListener('click', (event) => {
		event.preventDefault();
		onClear();
	});

	for (const selector of [CATEGORY_SELECTOR, SALARY_MIN_SELECTOR, SALARY_MAX_SELECTOR]) {
		document.querySelector(selector)?.addEventListener('input', onChange);
		document.querySelector(selector)?.addEventListener('change', onChange);
	}
}

function start(): void {
	const list = document.querySelector<HTMLElement>(LIST_SELECTOR);
	if (!list) {
		logEarly('Job list is missing.');
		return;
	}

	const template = takeCardTemplate(list);
	bindErrorCancel();
	if (!template) {
		logEarly('Job card is missing.');
		showError('Job card is missing.');
		return;
	}
	if (!readApiOrigin()) {
		logEarly('Careers API is not configured.');
		showError('Careers API is not configured.');
		return;
	}

	document.querySelector<HTMLFormElement>('#wf-form-Filter')?.addEventListener('submit', (event) => {
		event.preventDefault();
	});
	document.querySelector('[fs-cmsfilter-element="filters"]')?.removeAttribute('fs-cmsfilter-element');

	divisionInputs = fillChoices(DIVISION_SELECTOR, DIVISION_OPTIONS, 'division');
	employmentInputs = fillChoices(EMPLOYMENT_SELECTOR, EMPLOYMENT_OPTIONS, 'employment-type');
	salaryInputs = fillChoices(SALARY_SELECTOR, SALARY_OPTIONS, 'salary');
	functionInputs = fillChoices(FUNCTION_SELECTOR, JOB_FUNCTION_OPTIONS, 'job-function');
	if (!document.querySelector(`${REMOTE_SELECTOR} input`)) {
		logEarly('Remote option is missing.');
	}
	if (!document.querySelector(LOCATION_SELECTOR)) {
		logEarly('Location input is missing.');
	}

	const message = locationMessageNode(list);
	let loaded: JobSummary[] = [];
	let radius: JobSummary[] | null = null;
	let pending = 0;
	let locationPending = 0;
	let requestId = 0;

	const paint = () => {
		render(list, template, radius ?? loaded);
	};
	const schedule = () => {
		window.clearTimeout(pending);
		pending = window.setTimeout(paint, 150);
	};
	const applyLocation = () => {
		const place = readLocation();
		window.clearTimeout(locationPending);
		if (!place) {
			requestId += 1;
			radius = null;
			message.textContent = '';
			schedule();
			return;
		}

		locationPending = window.setTimeout(() => {
			requestId += 1;
			const id = requestId;
			void fetchJobsNear(place)
				.then((jobs) => {
					if (id !== requestId) {
						return;
					}
					if (jobs === null) {
						logEarly(`Could not resolve location: ${place}`);
						radius = null;
						message.textContent = LOCATION_MESSAGE;
						schedule();
						return;
					}

					radius = jobs;
					message.textContent = '';
					schedule();
				})
				.catch((error: unknown) => {
					if (id !== requestId) {
						return;
					}
					console.error('[job.ts] Location search failed', error);
					message.textContent = '';
					showError('Jobs could not be loaded. Please try again.');
				});
		}, 400);
	};
	const clearFilters = () => {
		const search = document.querySelector<HTMLInputElement>(SEARCH_SELECTOR) ?? document.querySelector<HTMLInputElement>(QUERY_SELECTOR);
		if (search) {
			search.value = '';
		}
		const location = document.querySelector<HTMLInputElement>(LOCATION_SELECTOR);
		if (location) {
			location.value = '';
		}
		const select = document.querySelector<HTMLSelectElement>('#Locations');
		if (select) {
			for (const option of select.options) {
				option.selected = false;
			}
		}
		for (const input of [...divisionInputs, ...employmentInputs, ...salaryInputs, ...functionInputs]) {
			input.checked = false;
		}
		const remote = document.querySelector<HTMLInputElement>(`${REMOTE_SELECTOR} input`);
		if (remote) {
			remote.checked = false;
		}
		syncInputs([...divisionInputs, ...employmentInputs, ...salaryInputs, ...functionInputs]);
		if (remote) {
			syncInput(remote);
		}
		const min = document.querySelector<HTMLInputElement>(SALARY_MIN_SELECTOR);
		const max = document.querySelector<HTMLInputElement>(SALARY_MAX_SELECTOR);
		if (min) {
			min.value = '';
		}
		if (max) {
			max.value = '';
		}
		const category = document.querySelector<HTMLSelectElement>(CATEGORY_SELECTOR);
		if (category) {
			category.value = '';
		}
		requestId += 1;
		window.clearTimeout(locationPending);
		radius = null;
		message.textContent = '';
		paint();
	};

	bindFilters(schedule, applyLocation, clearFilters);
	list.textContent = 'Loading jobs…';
	void fetchPublishedJobs()
		.then((jobs) => {
			loaded = jobs;
			fillCategories(jobs);
			paint();
		})
		.catch((error: unknown) => {
			console.error('[job.ts] Job list failed', error);
			list.textContent = '';
			showError('Jobs could not be loaded. Please try again.');
		});
}

start();
