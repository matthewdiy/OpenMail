import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

export function getDb(env?: CloudflareEnv) {
	const dbEnv = env ?? (getCloudflareContext().env);
	return drizzle(dbEnv.MAIL_DB);
}
