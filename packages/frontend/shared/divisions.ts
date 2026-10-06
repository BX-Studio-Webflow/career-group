/**
 * Highlight and chip colors by division.
 * CGC Internal has no color yet.
 */
const DIVISION_CHIP_COLORS: Record<string, string> = {
	'career group': '#b9373d',
	syndicatebleu: '#00abc7',
	'fourth floor': '#51afe2',
	'career group search': '#bab4ae',
	'career group events': '#f62dae',
};

export function divisionChipColor(division: string): string | null {
	return DIVISION_CHIP_COLORS[division.trim().toLowerCase()] ?? null;
}
