export function parseJobId(value: string): number | null {
	if (!/^[1-9]\d{0,14}$/.test(value)) {
		return null;
	}

	const id = Number(value);
	if (!Number.isSafeInteger(id)) {
		return null;
	}

	return id;
}

export function quoteWhere(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}
