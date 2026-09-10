import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema.ts";

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DATABASE_URL: string;
		}
	}
}

export const db = drizzle(process.env.DATABASE_URL, { schema });
