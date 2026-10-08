export interface AccordionAttributes {
	wrapper: string;
	item: string;
	header: string;
	body: string;
	duration?: number;
	activeClass?: string;
}

interface WebflowNamespace {
	push: (callback: () => void) => void;
}

function devTarget(name: string): string {
	return `[dev-target="${name}"]`;
}

function whenWebflowReady(run: () => void): void {
	const webflow = (window as Window & { Webflow?: WebflowNamespace | unknown[] }).Webflow;
	if (webflow && !Array.isArray(webflow) && typeof webflow.push === 'function') {
		webflow.push(run);
		return;
	}

	run();
}

class AccordionGroup {
	private readonly items: HTMLElement[] = [];
	private readonly duration: number;
	private readonly activeClass: string;
	private currentIndex = 0;
	private intervalId: number | null = null;

	constructor(
		private readonly wrapper: HTMLElement,
		private readonly attributes: AccordionAttributes,
	) {
		this.duration = attributes.duration ?? 0;
		this.activeClass = attributes.activeClass ?? 'is-active';
	}

	init(): void {
		const itemElements = [...this.wrapper.querySelectorAll<HTMLElement>(devTarget(this.attributes.item))];

		for (const item of itemElements) {
			const header = item.querySelector<HTMLElement>(devTarget(this.attributes.header));
			const body = item.querySelector<HTMLElement>(devTarget(this.attributes.body));
			if (!header) {
				console.error(`[accordion] An item is missing [dev-target="${this.attributes.header}"].`);
				continue;
			}
			if (!body) {
				console.error(`[accordion] An item is missing [dev-target="${this.attributes.body}"].`);
				continue;
			}

			const index = this.items.length;
			header.addEventListener('click', () => {
				this.handleHeaderClick(index);
			});
			this.items.push(item);
		}

		if (this.items.length === 0) {
			console.error(`[accordion] No valid items found for [dev-target="${this.attributes.item}"].`);
			return;
		}

		this.items[0]?.classList.add(this.activeClass);
		this.startAutoCycle();
	}

	private activateItem(index: number): void {
		const item = this.items[index];
		if (!item) {
			return;
		}

		item.classList.add(this.activeClass);
		this.currentIndex = index;
	}

	private handleHeaderClick(index: number): void {
		const item = this.items[index];
		if (!item) {
			return;
		}

		item.classList.toggle(this.activeClass);
		this.currentIndex = index;
		this.stop();
		this.startAutoCycle();
	}

	private startAutoCycle(): void {
		if (this.duration <= 0 || this.items.length < 2) {
			return;
		}

		this.intervalId = window.setInterval(() => {
			const nextIndex = (this.currentIndex + 1) % this.items.length;
			this.activateItem(nextIndex);
		}, this.duration);
	}

	private stop(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}

export class Accordion {
	constructor(private readonly attributes: AccordionAttributes) {}

	mount(root: ParentNode = document): void {
		whenWebflowReady(() => {
			this.mountNow(root);
		});
	}

	private mountNow(root: ParentNode): void {
		const wrappers = [...root.querySelectorAll<HTMLElement>(devTarget(this.attributes.wrapper))];
		if (wrappers.length === 0) {
			const parents = new Set<HTMLElement>();
			for (const item of root.querySelectorAll<HTMLElement>(devTarget(this.attributes.item))) {
				if (item.parentElement) {
					parents.add(item.parentElement);
				}
			}
			wrappers.push(...parents);
		}

		if (wrappers.length === 0) {
			console.error(`[accordion] No elements found with [dev-target="${this.attributes.wrapper}"].`);
			return;
		}

		for (const wrapper of wrappers) {
			new AccordionGroup(wrapper, this.attributes).init();
		}
	}
}
