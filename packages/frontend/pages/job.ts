import { fetchJob, submitApplication } from '../shared/api';
import { bindErrorCancel, hideError, showError } from '../shared/errors';
import { formatSalaryRange } from '../shared/jobs';

const FORM_SELECTOR = '[dev-target="apply-form"]';
const DESCRIPTION_SELECTOR = '[dev-target="job-description"]';
const SUCCESS_SELECTOR = '[dev-target="apply-success"]';

function setText(target: string, value: string): void {
	const node = document.querySelector<HTMLElement>(`[dev-target="${target}"]`);
	if (node) {
		node.textContent = value;
	}
}

function fillJob(title: string, location: string, employmentType: string, category: string, salary: string, description: string): void {
	setText('job-title', title);
	setText('job-location', location);
	setText('job-type', employmentType);
	setText('job-category', category);
	setText('job-salary', salary);
	document.title = title;

	const descriptionNode = document.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
	if (descriptionNode) {
		descriptionNode.innerHTML = description;
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

				fillJob(job.title, job.location, job.employmentType, job.category, formatSalaryRange(job), job.description);
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
