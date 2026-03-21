import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, count, desc, eq, isNotNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
	draftEmails,
	emails,
	sentEmails,
	userEmails,
	type DraftEmailRow,
	type EmailRow,
	type SentEmailRow,
} from "@/lib/schema";

function getEnv(): CloudflareEnv {
	return getCloudflareContext().env;
}

export type InboxMailbox = "inbox" | "starred" | "trash";
type InboxListOptions = {
	mailbox: InboxMailbox;
	category?: string;
	limit?: number;
	offset?: number;
};

function buildInboxConditions(
	toAddress: string,
	options: {
		mailbox: InboxMailbox;
		category?: string;
	}
) {
	const conditions = [eq(emails.to_addr, toAddress)];

	if (options.mailbox === "trash") {
		conditions.push(eq(emails.deleted, true));
	} else {
		conditions.push(eq(emails.deleted, false));
	}

	if (options.mailbox === "starred") {
		conditions.push(eq(emails.starred, true));
	}

	const normalizedCategory = options.category?.trim();
	if (normalizedCategory) {
		conditions.push(eq(emails.category, normalizedCategory));
	}

	return conditions;
}

export async function listOwnedEmailAddresses(userId: string | null | undefined): Promise<string[]> {
	const db = getDb();
	if (!userId) return [];
	const rows = await db
		.select({ emailAddress: userEmails.emailAddress })
		.from(userEmails)
		.where(eq(userEmails.userId, userId))
		.orderBy(asc(userEmails.createdAt))
		.all();
	return rows.map((row) => row.emailAddress);
}

export async function resolveActiveEmailAddress(
	userId: string | null | undefined,
	requestedEmail?: string | null
): Promise<{ activeEmail: string | null; emailAddresses: string[]; needsRedirect: boolean }> {
	const emailAddresses = await listOwnedEmailAddresses(userId);
	if (emailAddresses.length === 0) {
		return { activeEmail: null, emailAddresses, needsRedirect: false };
	}

	const normalizedRequested = requestedEmail?.trim().toLowerCase();
	if (!normalizedRequested) {
		return {
			activeEmail: emailAddresses[0],
			emailAddresses,
			needsRedirect: true,
		};
	}

	const matched = emailAddresses.find(
		(emailAddress) => emailAddress.toLowerCase() === normalizedRequested
	);
	if (!matched) {
		return {
			activeEmail: emailAddresses[0],
			emailAddresses,
			needsRedirect: true,
		};
	}

	return {
		activeEmail: matched,
		emailAddresses,
		needsRedirect: matched !== requestedEmail,
	};
}

export async function listInboxEmailsByAddress(
	toAddress: string,
	options: InboxListOptions
): Promise<EmailRow[]> {
	const db = getDb();
	const conditions = buildInboxConditions(toAddress, options);

	return db
		.select()
		.from(emails)
		.where(and(...conditions))
		.orderBy(desc(emails.received_at))
		.limit(options.limit ?? 50)
		.offset(options.offset ?? 0)
		.all();
}

export async function countInboxEmailsByAddress(
	toAddress: string,
	options: {
		mailbox: InboxMailbox;
		category?: string;
	}
): Promise<number> {
	const db = getDb();
	const conditions = buildInboxConditions(toAddress, options);
	const rows = await db
		.select({ value: count() })
		.from(emails)
		.where(and(...conditions))
		.limit(1)
		.all();
	return Number(rows[0]?.value ?? 0);
}

export async function listSentEmailsByAddress(
	fromAddress: string,
	limit = 50,
	offset = 0
): Promise<EmailRow[]> {
	const db = getDb();
	const rows = await db
		.select()
		.from(sentEmails)
		.where(eq(sentEmails.from_addr, fromAddress))
		.orderBy(desc(sentEmails.received_at))
		.limit(limit)
		.offset(offset)
		.all();

	// Map to EmailRow shape for frontend compatibility
	return rows.map((r) => ({
		...r,
		message_id: null,
		r2_key: "",
		size_bytes: null,
		starred: false,
		deleted: false,
		deleted_at: null,
		read: true,
		verification_code: null,
		summary: null,
		category: null,
	} as EmailRow));
}

export async function countSentEmailsByAddress(fromAddress: string): Promise<number> {
	const db = getDb();
	const rows = await db
		.select({ value: count() })
		.from(sentEmails)
		.where(eq(sentEmails.from_addr, fromAddress))
		.limit(1)
		.all();
	return Number(rows[0]?.value ?? 0);
}

export async function listDistinctInboxCategoriesByAddress(toAddress: string): Promise<string[]> {
	const db = getDb();
	const rows = await db
		.selectDistinct({ category: emails.category })
		.from(emails)
		.where(
			and(
				eq(emails.to_addr, toAddress),
				eq(emails.deleted, false),
				isNotNull(emails.category),
				ne(emails.category, "")
			)
		)
		.all();

	return rows
		.map((row) => row.category?.trim())
		.filter((value): value is string => Boolean(value));
}

export async function listDraftEmailsByAddress(
	userId: string,
	fromAddress: string,
	limit = 50
): Promise<DraftEmailRow[]> {
	const db = getDb();
	return db
		.select()
		.from(draftEmails)
		.where(and(eq(draftEmails.userId, userId), eq(draftEmails.from_addr, fromAddress)))
		.orderBy(desc(draftEmails.updated_at))
		.limit(limit)
		.all();
}

export async function getDraftByIdForAddress(
	id: string,
	userId: string,
	fromAddress: string
): Promise<DraftEmailRow | null> {
	const db = getDb();
	const rows = await db
		.select()
		.from(draftEmails)
		.where(
			and(
				eq(draftEmails.id, id),
				eq(draftEmails.userId, userId),
				eq(draftEmails.from_addr, fromAddress)
			)
		)
		.limit(1)
		.all();
	return rows[0] ?? null;
}

export async function getEmailById(id: string, userId?: string | null): Promise<EmailRow | null> {
	const db = getDb();
	const conditions = [eq(emails.id, id)];
	if (userId) {
		conditions.push(eq(emails.userId, userId));
	}
	const rows = await db.select().from(emails).where(and(...conditions)).limit(1).all();
	return rows[0] ?? null;
}

export async function getEmailByIdForAddress(id: string, toAddress: string): Promise<EmailRow | null> {
	const db = getDb();
	const rows = await db
		.select()
		.from(emails)
		.where(and(eq(emails.id, id), eq(emails.to_addr, toAddress)))
		.limit(1)
		.all();
	return rows[0] ?? null;
}

export async function getSentEmailById(id: string, userId?: string | null): Promise<SentEmailRow | null> {
	const db = getDb();
	const conditions = [eq(sentEmails.id, id)];
	if (userId) {
		conditions.push(eq(sentEmails.userId, userId));
	}
	const rows = await db.select().from(sentEmails).where(and(...conditions)).limit(1).all();
	return rows[0] ?? null;
}

export async function getSentEmailByIdForAddress(id: string, fromAddress: string): Promise<SentEmailRow | null> {
	const db = getDb();
	const rows = await db
		.select()
		.from(sentEmails)
		.where(and(eq(sentEmails.id, id), eq(sentEmails.from_addr, fromAddress)))
		.limit(1)
		.all();
	return rows[0] ?? null;
}

export async function getEmailObject(r2Key: string): Promise<R2ObjectBody | null> {
	const env = getEnv();
	return env.MAIL_R2.get(r2Key);
}
