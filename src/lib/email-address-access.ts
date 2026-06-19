import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userEmails } from "@/lib/schema";
import { getEmailAccountQuotaByUserId } from "@/lib/user-access";

export type LinkEmailAddressOptions = {
	userId: string;
	emailAddress: string;
	isAdmin?: boolean;
	temporary?: boolean;
	expireDay?: number;
};

export function normalizeEmailAddress(emailAddress: string) {
	return emailAddress.trim().toLowerCase();
}

function buildExpiredDate(temporary: boolean | undefined, expireDay: number | undefined) {
	if (!temporary) return null;
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + (expireDay ?? 1));
	return expiresAt.toISOString();
}

/** Link a receiving address after checking uniqueness and user quota. */
export async function linkEmailAddressForUser({
	userId,
	emailAddress,
	isAdmin = false,
	temporary = false,
	expireDay,
}: LinkEmailAddressOptions) {
	const normalizedEmail = normalizeEmailAddress(emailAddress);
	if (!normalizedEmail) {
		throw new Error("Email address is required.");
	}
	const resolvedExpireDay = expireDay ?? 1;
	if (temporary && (!Number.isInteger(resolvedExpireDay) || resolvedExpireDay <= 0)) {
		throw new Error("Expire day must be a positive integer.");
	}
	const expiredDate = buildExpiredDate(temporary, resolvedExpireDay);

	const db = getDb();
	const existingRows = await db
		.select({ userId: userEmails.userId })
		.from(userEmails)
		.where(eq(userEmails.emailAddress, normalizedEmail))
		.limit(1)
		.all();
	const existingOwnerId = existingRows[0]?.userId;
	if (existingOwnerId === userId) {
		throw new Error("This email address is already linked to your account.");
	}
	if (existingOwnerId && existingOwnerId !== userId) {
		throw new Error("This email address is already in use.");
	}

	if (!isAdmin) {
		const countRows = await db
			.select({ count: sql<number>`count(*)` })
			.from(userEmails)
			.where(eq(userEmails.userId, userId))
			.all();
		const linkedCount = Number(countRows[0]?.count ?? 0);
		const quota = await getEmailAccountQuotaByUserId(userId);
		if (linkedCount >= quota) {
			throw new Error(`Email account quota reached (${quota}).`);
		}
	}

	await db
		.insert(userEmails)
		.values({
			userId,
			emailAddress: normalizedEmail,
			createdAt: new Date().toISOString(),
			expiredDate,
		})
		.onConflictDoNothing()
		.run();

	const postInsertRows = await db
		.select({ userId: userEmails.userId })
		.from(userEmails)
		.where(eq(userEmails.emailAddress, normalizedEmail))
		.limit(1)
		.all();
	if (postInsertRows[0]?.userId !== userId) {
		throw new Error("This email address is already in use.");
	}

	return { emailAddress: normalizedEmail, expiredDate };
}

/** Unlink only addresses currently owned by the user. */
export async function unlinkEmailAddressForUser(userId: string, emailAddress: string) {
	const normalizedEmail = normalizeEmailAddress(emailAddress);
	if (!normalizedEmail) {
		throw new Error("Email address is required.");
	}

	const db = getDb();
	await db
		.delete(userEmails)
		.where(and(eq(userEmails.userId, userId), eq(userEmails.emailAddress, normalizedEmail)))
		.run();

	return normalizedEmail;
}

export async function userOwnsEmailAddress(userId: string, emailAddress: string) {
	const normalizedEmail = normalizeEmailAddress(emailAddress);
	if (!normalizedEmail) return false;
	const db = getDb();
	const rows = await db
		.select({ emailAddress: userEmails.emailAddress })
		.from(userEmails)
		.where(and(eq(userEmails.userId, userId), eq(userEmails.emailAddress, normalizedEmail)))
		.limit(1)
		.all();
	return rows.length > 0;
}
