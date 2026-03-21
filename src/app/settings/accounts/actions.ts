"use server";
import { getDb } from "@/lib/db";
import { userEmails } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { getEmailAccountQuotaByUserId } from "@/lib/user-access";

export async function addEmailAccountAction(emailAddress: string) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	const normalizedEmail = emailAddress.trim().toLowerCase();
	if (!normalizedEmail) {
		throw new Error("Email address is required.");
	}
	const db = getDb();
	const existingRows = await db
		.select({ userId: userEmails.userId })
		.from(userEmails)
		.where(eq(userEmails.emailAddress, normalizedEmail))
		.limit(1)
		.all();
	const existingOwnerId = existingRows[0]?.userId;
	if (existingOwnerId === session.user.id) {
		throw new Error("This email address is already linked to your account.");
	}
	if (existingOwnerId && existingOwnerId !== session.user.id) {
		throw new Error("This email address is already in use.");
	}

	const isAdmin = session.user.role === "admin";
	if (!isAdmin) {
		const countRows = await db
			.select({ count: sql<number>`count(*)` })
			.from(userEmails)
			.where(eq(userEmails.userId, session.user.id))
			.all();
		const linkedCount = Number(countRows[0]?.count ?? 0);
		const quota = await getEmailAccountQuotaByUserId(session.user.id);
		if (linkedCount >= quota) {
			throw new Error(`Email account quota reached (${quota}).`);
		}
	}

	await db
		.insert(userEmails)
		.values({
			userId: session.user.id,
			emailAddress: normalizedEmail,
			createdAt: new Date().toISOString(),
		})
		.onConflictDoNothing()
		.run();

	// Another request can win the same email between those steps (race condition).
	const postInsertRows = await db
		.select({ userId: userEmails.userId })
		.from(userEmails)
		.where(eq(userEmails.emailAddress, normalizedEmail))
		.limit(1)
		.all();
	if (postInsertRows[0]?.userId !== session.user.id) {
		throw new Error("This email address is already in use.");
	}

	revalidatePath("/settings/accounts");
	revalidatePath("/onboard");
	revalidatePath("/mail");
}

export async function deleteEmailAccountAction(emailAddress: string) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	const normalizedEmail = emailAddress.trim().toLowerCase();
	if (!normalizedEmail) {
		throw new Error("Email address is required.");
	}

	const db = getDb();
	await db.delete(userEmails).where(
		and(
			eq(userEmails.userId, session.user.id),
			eq(userEmails.emailAddress, normalizedEmail)
		)
	).run();

	revalidatePath("/settings/accounts");
	revalidatePath("/settings/admin");
}
