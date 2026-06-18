import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "../lib/db";
import { emails, userEmails } from "../lib/schema";

async function deleteExpiredAddressMail(
	db: ReturnType<typeof getDb>,
	env: CloudflareEnv,
	userId: string,
	emailAddress: string
) {
	const normalizedAddress = emailAddress.trim().toLowerCase();
	const addressMailFilter = and(
		eq(emails.userId, userId),
		eq(sql`lower(${emails.to_addr})`, normalizedAddress)
	);
	const expiredEmails = await db
		.select({ r2Key: emails.r2_key })
		.from(emails)
		.where(addressMailFilter)
		.all();

	for (const expiredEmail of expiredEmails) {
		await env.MAIL_R2.delete(expiredEmail.r2Key);
	}

	await db.delete(emails).where(addressMailFilter).run();
	await db
		.delete(userEmails)
		.where(
			and(
				eq(userEmails.userId, userId),
				eq(userEmails.emailAddress, normalizedAddress)
			)
		)
		.run();
}

/** Remove expired temporary addresses and their incoming raw/metadata records. */
export async function cleanupExpiredEmailAddresses(
	db: ReturnType<typeof getDb>,
	env: CloudflareEnv
) {
	const now = new Date().toISOString();
	const expiredAddressRows = await db
		.select({
			userId: userEmails.userId,
			emailAddress: userEmails.emailAddress,
		})
		.from(userEmails)
		.where(and(isNotNull(userEmails.expiredDate), lte(userEmails.expiredDate, now)))
		.all();

	for (const expiredAddress of expiredAddressRows) {
		try {
			await deleteExpiredAddressMail(
				db,
				env,
				expiredAddress.userId,
				expiredAddress.emailAddress
			);
		} catch (error) {
			console.error("Failed to clean up expired email address:", {
				userId: expiredAddress.userId,
				emailAddress: expiredAddress.emailAddress,
				error,
			});
		}
	}
}
