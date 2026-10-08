const ERROR_WRAPPER_SELECTOR = '[dev-target="error-wrapper"]';
const ERROR_TEXT_SELECTOR = '[dev-target="error-text"]';
const ERROR_CANCEL_SELECTOR = '[dev-target="cancel"]';

export function showError(message: string): void {
	const wrapper = document.querySelector<HTMLElement>(ERROR_WRAPPER_SELECTOR);
	const text = wrapper?.querySelector<HTMLElement>(ERROR_TEXT_SELECTOR);
	if (!wrapper || !text) {
		console.error('[job.ts] Error wrapper is missing.');
		return;
	}

	text.textContent = message;
	wrapper.classList.remove('hide');
}

export function hideError(): void {
	document.querySelector<HTMLElement>(ERROR_WRAPPER_SELECTOR)?.classList.add('hide');
}

export function bindErrorCancel(): void {
	document.querySelectorAll<HTMLElement>(ERROR_CANCEL_SELECTOR).forEach((cancel) => {
		cancel.addEventListener('click', hideError);
	});
}
