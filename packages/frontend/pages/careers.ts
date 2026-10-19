import { fetchPublishedJobs, readApiOrigin } from '../shared/api';
import { divisionChipColor } from '../shared/divisions';
import { formatSalaryRange, type JobSummary } from '../shared/jobs';

const ROW_SELECTOR = '[dev-target="roles-row"]';
const CARD_SELECTOR = '[dev-target="roles-card"]';

function log(message: string): void {
	console.error(`[careers.ts] ${message}`);
}

function setText(root: ParentNode, target: string, value: string): void {
	const node = root.querySelector<HTMLElement>(`[dev-target="${target}"]`);
	if (node) {
		node.textContent = value;
	}
}

function detailHref(row: HTMLElement, id: number): string {
	const path = row.getAttribute('detail-path')?.trim() || '/dev/job-posting-dev';
	const url = new URL(path, window.location.origin);
	url.searchParams.set('id', String(id));
	return `${url.pathname}${url.search}`;
}

function fillCard(card: HTMLElement, job: JobSummary, href: string): void {
	const division = job.division?.trim() ?? '';
	const chip = card.querySelector<HTMLElement>('[dev-target="division-chip"]');
	if (chip) {
		chip.classList.toggle('hide', division.length === 0);
		const color = divisionChipColor(division);
		if (color) {
			chip.style.backgroundColor = color;
		} else {
			chip.style.removeProperty('background-color');
		}
	}

	setText(card, 'division-text', division);
	setText(card, 'title', job.title);
	setText(card, 'location', job.location);

	const salary = formatSalaryRange(job);
	setText(card, 'salary', salary);
	card
		.querySelector('[dev-target="salary"]')
		?.closest('.salary')
		?.classList.toggle('hide', salary.length === 0);

	const apply = card.querySelector<HTMLAnchorElement>('[dev-target="apply-cta"]');
	if (apply) {
		apply.href = href;
	}
}

function takeTemplate(row: HTMLElement): HTMLElement | null {
	const card = row.querySelector<HTMLElement>(CARD_SELECTOR);
	if (!card) {
		return null;
	}

	const template = card.cloneNode(true) as HTMLElement;
	card.remove();
	return template;
}

function render(row: HTMLElement, template: HTMLElement, jobs: JobSummary[]): void {
	row.replaceChildren();
	for (const job of jobs) {
		const card = template.cloneNode(true) as HTMLElement;
		fillCard(card, job, detailHref(row, job.id));
		row.append(card);
	}
}

function start(): void {
	const rows = [...document.querySelectorAll<HTMLElement>(ROW_SELECTOR)];
	if (rows.length === 0) {
		log('Roles row is missing.');
		return;
	}

	const ready = rows.flatMap((row) => {
		const template = takeTemplate(row);
		return template ? [{ row, template }] : [];
	});
	if (ready.length === 0) {
		log('Roles card is missing.');
		return;
	}

	if (!readApiOrigin()) {
		log('Careers API is not configured.');
		return;
	}

	void fetchPublishedJobs()
		.then((jobs) => {
			for (const { row, template } of ready) {
				render(row, template, jobs);
			}
		})
		.catch((error: unknown) => {
			console.error('[careers.ts] Job list failed', error);
		});
}

start();
