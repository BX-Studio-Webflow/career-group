import type { Env as HonoEnv } from 'hono';

export interface AppEnv extends HonoEnv {
	Variables: {
		requestId: string;
	};
}
