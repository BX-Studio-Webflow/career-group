interface Turnstile {
	reset: (widgetId?: string) => void;
}

interface Window {
	CAREERS_API_ORIGIN?: string;
	turnstile?: Turnstile;
}

declare const API_ORIGIN: string;
