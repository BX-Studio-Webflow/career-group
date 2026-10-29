import type { ApplicationInput } from '../validate.js';

/** Bullhorn Candidate Referral Source for applicants created from the careers site. */
export const CANDIDATE_SOURCE = 'CGC Website';

export function candidateFields(application: ApplicationInput, options?: { status?: string; source?: string }): Record<string, unknown> {
	const name = `${application.firstName} ${application.lastName}`.slice(0, 100);
	const payload: Record<string, unknown> = {
		firstName: application.firstName,
		lastName: application.lastName,
		name,
		email: application.email,
		phone: application.phone,
		address: {
			city: application.city,
			state: application.state,
		},
	};

	if (application.linkedinUrl) {
		payload.customText8 = application.linkedinUrl;
	}
	if (application.portfolioUrl) {
		payload.companyURL = application.portfolioUrl;
	}
	if (options?.source) {
		payload.source = options.source;
	}
	if (options?.status) {
		payload.status = options.status;
	}

	return payload;
}
