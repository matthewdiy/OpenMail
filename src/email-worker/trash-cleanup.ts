import { and, eq, isNotNull, lte } from "drizzle-orm";
import { getDb } from "../lib/db";
import { emails } from "../lib/schema";

/** Remove trashed emails whose per-message retention deadline has passed. */
export async function cleanupExpiredTrashEmails(
	db: ReturnType<typeof getDb>,
	env: CloudflareEnv
) {
	const now = new Date().toISOString();
	const expiredEmails = await db
		.select({ id: emails.id, r2Key: emails.r2_key })
		.from(emails)
		.where(
			and(
				eq(emails.deleted, true),
				isNotNull(emails.trashExpiredDate),
				lte(emails.trashExpiredDate, now)
			)
		)
		.all();

	for (const expiredEmail of expiredEmails) {
		await env.MAIL_R2.delete(expiredEmail.r2Key);
		await db.delete(emails).where(eq(emails.id, expiredEmail.id)).run();
	}
}
