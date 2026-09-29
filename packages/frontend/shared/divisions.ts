/**
 * Background colors read from division chips on
 * https://www.careergroupcompanies.com/find-work
 * Career Group Events and CGC Internal are filter options there, but no
 * posted job had a chip, so they have no color yet.
 */
const DIVISION_CHIP_COLORS: Record<string, string> = {
	'career group': '#b9373d',
	syndicatebleu: '#00abc7',
	'fourth floor': '#51afe2',
	'career group search': '#bab4ae',
};

export function divisionChipColor(division: string): string | null {
	return DIVISION_CHIP_COLORS[division.trim().toLowerCase()] ?? null;
}
