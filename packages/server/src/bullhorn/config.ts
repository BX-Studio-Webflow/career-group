export interface BullhornConfig {
	clientId: string;
	clientSecret: string;
	username: string;
	password: string;
	submissionStatus: string;
	candidateStatus: string;
	authUrl: string;
	restLoginUrl: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): BullhornConfig | null {
	const clientId = env.BULLHORN_CLIENT_ID?.trim() ?? '';
	const clientSecret = env.BULLHORN_CLIENT_SECRET?.trim() ?? '';
	const username = env.BULLHORN_API_USERNAME?.trim() ?? '';
	const password = env.BULLHORN_API_PASSWORD ?? '';

	if (!clientId || !clientSecret || !username || !password) {
		return null;
	}

	return {
		clientId,
		clientSecret,
		username,
		password,
		submissionStatus: env.BULLHORN_SUBMISSION_STATUS?.trim() || 'Web Response',
		candidateStatus: env.BULLHORN_CANDIDATE_STATUS?.trim() ?? '',
		authUrl: 'https://auth.bullhornstaffing.com',
		restLoginUrl: 'https://rest.bullhornstaffing.com/rest-services/login',
	};
}
