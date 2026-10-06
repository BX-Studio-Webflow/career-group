import { fetchJob, submitApplication } from '../shared/api';
import { divisionChipColor } from '../shared/divisions';
import { bindErrorCancel, hideError, showError } from '../shared/errors';
import { formatSalaryRange } from '../shared/jobs';

const DIVISION_CARDS: Record<string, string> = {
	'career group': 'division-card-career-grp',
	syndicatebleu: 'division-card-syndicate',
	'fourth floor': 'division-card-fourth-floor',
	'career group search': 'division-card-career-grp-search',
	'career group events': 'division-card-career-grp-events',
	'cgc internal': 'division-card-career-grp-companies',
};

const FORM_SELECTOR = '[dev-target="apply-form"]';
const DESCRIPTION_SELECTOR = '[dev-target="job-description"]';
const SUCCESS_SELECTOR = '[dev-target="apply-success"]';

function setText(target: string, value: string): void {
	const node = document.querySelector<HTMLElement>(`[dev-target="${target}"]`);
	if (node) {
		node.textContent = value;
	}
}

function fillJob(title: string, location: string, employmentType: string, category: string, salary: string, description: string, division: string): void {
	setText('job-title', title);
	setText('job-location', location);
	setText('job-type', employmentType);
	setText('job-category', category);
	setText('job-salary', salary);
	setText('division', division);
	fillHighlight(division);
	showDivisionCard(division);
	document.title = title;

	const descriptionNode = document.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
	if (descriptionNode) {
		descriptionNode.innerHTML = description;
	}
}

function fillHighlight(division: string): void {
	const card = document.querySelector<HTMLElement>('[dev-target="job-highlights"]');
	if (!card) {
		return;
	}

	const color = divisionChipColor(division);
	if (color) {
		card.style.backgroundColor = color;
		return;
	}

	card.style.removeProperty('background-color');
}

function divisionCardTarget(card: HTMLElement): string {
	return card.getAttribute('dev-target') ?? card.getAttribute('dvev-target') ?? '';
}

function showDivisionCard(division: string): void {
	const active = DIVISION_CARDS[division.trim().toLowerCase()] ?? '';
	const cards = document.querySelectorAll<HTMLElement>('[dev-target^="division-card-"], [dvev-target^="division-card-"]');
	for (const card of cards) {
		card.classList.toggle('hide', divisionCardTarget(card) !== active);
	}
}

function showSuccess(message: string): void {
	const success = document.querySelector<HTMLElement>(SUCCESS_SELECTOR);
	if (!success) {
		showError(message);
		return;
	}

	success.textContent = message;
	success.classList.remove('hide');
	hideError();
}

function bindForm(form: HTMLFormElement, id: string): void {
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (submit) {
			submit.disabled = true;
		}

		void submitApplication(id, new FormData(form))
			.then((result) => {
				if (!result.ok) {
					showError(result.message || 'Your application could not be submitted. Please try again.');
					return;
				}

				if (result.alreadyApplied && result.resumeAttached === false) {
					showSuccess('You already applied for this job, and the resume could not be attached.');
					return;
				}
				if (result.alreadyApplied) {
					showSuccess('You already applied for this job.');
					return;
				}
				if (result.resumeAttached === false) {
					showSuccess('Your application was submitted, but the resume could not be attached.');
					return;
				}

				showSuccess('Your application was submitted.');
				form.reset();
			})
			.catch((error: unknown) => {
				console.error('[Careers] Application failed', error);
				showError('Your application could not be submitted. Please try again.');
			})
			.finally(() => {
				if (submit) {
					submit.disabled = false;
				}
			});
	});
}

const form = document.querySelector<HTMLFormElement>(FORM_SELECTOR);
const description = document.querySelector(DESCRIPTION_SELECTOR);
if (form || description) {
	bindErrorCancel();
	const id = new URLSearchParams(window.location.search).get('id')?.trim() ?? '';

	if (!/^[1-9]\d{0,14}$/.test(id)) {
		showError('This job link is incomplete.');
	} else {
		void fetchJob(id)
			.then((job) => {
				if (!job) {
					showError('This job is no longer available.');
					return;
				}

				fillJob(job.title, job.location, job.employmentType, job.category, formatSalaryRange(job), job.description, job.division?.trim() ?? '');
				if (form) {
					bindForm(form, id);
				}
			})
			.catch((error: unknown) => {
				console.error('[Careers] Job detail failed', error);
				showError('This job could not be loaded. Please try again.');
			});
	}
}
