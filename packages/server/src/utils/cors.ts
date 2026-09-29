const ALLOWED_DOMAINS = ['careergroupcompanies.com', 'webflow.io'];

function isAllowedHost(hostname: string): boolean {
	return ALLOWED_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function allowedOrigin(request: Request, corsOrigins: string): string | null {
	const origin = request.headers.get('Origin');
	const configured = corsOrigins
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);

	if (configured.includes('*')) {
		return origin || '*';
	}

	if (!origin) {
		return null;
	}

	if (configured.includes(origin)) {
		return origin;
	}

	try {
		if (isAllowedHost(new URL(origin).hostname)) {
			return origin;
		}
	} catch {
		return null;
	}

	return null;
}

export function corsHeaders(origin: string | null): Record<string, string> {
	const headers: Record<string, string> = {
		Vary: 'Origin',
		'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Accept',
		'Access-Control-Max-Age': '86400',
	};

	if (origin) {
		headers['Access-Control-Allow-Origin'] = origin;
	}

	return headers;
}

export function withCors(response: Response, origin: string | null): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders(origin))) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function preflightResponse(origin: string | null): Response {
	return new Response(null, {
		status: 204,
		headers: corsHeaders(origin),
	});
}
