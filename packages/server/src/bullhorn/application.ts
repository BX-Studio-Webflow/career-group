import { type ApplicationInput, REFERRAL_SOURCES } from '../validate.js';

/**
 * Bullhorn stores this option with a non-breaking space.
 * A normal space is rejected by the Referral Source picklist.
 */
const LINKEDIN_SOURCE = 'LinkedIn\u00a0Search';

const SOURCE_BY_REFERRAL: Record<(typeof REFERRAL_SOURCES)[number], string> = {
	"I'm an existing candidate": 'Other',
	Instagram: 'Instagram',
	'Internet Search': 'Internet/Google Search',
	'Email Marketing': 'Other',
	LinkedIn: LINKEDIN_SOURCE,
	Pinterest: 'Other',
	'Referred by a peer': 'Referral - Applicant referred Applicant',
	Others: 'Other',
};

export function candidateFields(application: ApplicationInput, status?: string): Record<string, unknown> {
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
		source: SOURCE_BY_REFERRAL[application.referral],
	};

	if (application.linkedinUrl) {
		payload.customText8 = application.linkedinUrl;
	}
	if (application.portfolioUrl) {
		payload.companyURL = application.portfolioUrl;
	}
	if (status) {
		payload.status = status;
	}

	return payload;
}
