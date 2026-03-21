// @ts-ignore `.open-next/worker.ts` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { email } from "./src/email-worker";

export default {
	fetch: handler.fetch,
	email,
} satisfies ExportedHandler<CloudflareEnv>;

// The re-export is only required if your app uses the DO Queue and DO Tag Cache.
// @ts-ignore `.open-next/worker.ts` is generated at build time
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
