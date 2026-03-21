"use server";
import { getDb } from "@/lib/db";
import { draftEmails, emails, sentEmails, userEmails } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/mailer";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";

export async function toggleStarAction(emailId: string, starred: boolean) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	const db = getDb();
	await db.update(emails)
		.set({ starred: !starred })
		.where(and(eq(emails.id, emailId), eq(emails.userId, session.user.id)))
		.run();
	revalidatePath("/mail");
}

export async function toggleDeleteAction(emailId: string, deleted: boolean) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	const db = getDb();
	const deletedAt = !deleted ? new Date().toISOString() : null;
	await db.update(emails)
		.set({ deleted: !deleted, deleted_at: deletedAt })
		.where(and(eq(emails.id, emailId), eq(emails.userId, session.user.id)))
		.run();
	revalidatePath("/mail");
}

export async function toggleReadAction(emailId: string, read: boolean) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	const db = getDb();
	await db.update(emails)
		.set({ read: !read })
		.where(and(eq(emails.id, emailId), eq(emails.userId, session.user.id)))
		.run();
	revalidatePath("/mail");
}

export async function softDeleteManyEmailsAction(emailIds: string[]) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (emailIds.length === 0) return;

	const db = getDb();
	await db.update(emails)
		.set({ deleted: true, deleted_at: new Date().toISOString() })
		.where(and(eq(emails.userId, session.user.id), inArray(emails.id, emailIds)))
		.run();
	revalidatePath("/mail");
}

export async function hardDeleteManyEmailsAction(emailIds: string[]) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (emailIds.length === 0) return;

	const db = getDb();
	await db.delete(emails)
		.where(and(eq(emails.userId, session.user.id), inArray(emails.id, emailIds)))
		.run();
	revalidatePath("/mail");
}

export async function setReadManyEmailsAction(emailIds: string[], read: boolean) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (emailIds.length === 0) return;

	const db = getDb();
	await db.update(emails)
		.set({ read })
		.where(and(eq(emails.userId, session.user.id), inArray(emails.id, emailIds)))
		.run();
	revalidatePath("/mail");
}

export async function hardDeleteManySentEmailsAction(emailIds: string[]) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (emailIds.length === 0) return;

	const db = getDb();
	await db.delete(sentEmails)
		.where(and(eq(sentEmails.userId, session.user.id), inArray(sentEmails.id, emailIds)))
		.run();
	revalidatePath("/mail");
}

export async function sendEmailAction(formData: {
	from: string;
	to: string;
	subject: string;
	text: string;
	html?: string;
	draftId?: string;
}) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	const { from, to, subject, text, html, draftId } = formData;

	if (!from) {
		throw new Error("From address is required.");
	}

	const db = getDb();
	const isOwner = await db.select()
		.from(userEmails)
		.where(and(eq(userEmails.userId, session.user.id), eq(userEmails.emailAddress, from)))
		.limit(1)
		.all();

	if (isOwner.length === 0) {
		throw new Error("You do not own this email address.");
	}

	const result = await sendEmail({
		to,
		subject,
		text,
		html,
		from: from ? { email: from } : undefined
	});

	// Record the sent email
	await db.insert(sentEmails).values({
		id: crypto.randomUUID(),
		userId: session.user.id,
		from_addr: from,
		to_addr: to,
		subject: subject || null,
		snippet: text ? text.slice(0, 160) : "",
		received_at: new Date().toISOString(),
	}).run();

	if (draftId) {
		await db
			.delete(draftEmails)
			.where(
				and(
					eq(draftEmails.id, draftId),
					eq(draftEmails.userId, session.user.id),
					eq(draftEmails.from_addr, from)
				)
			)
			.run();
	}

	revalidatePath("/mail");
	revalidatePath("/mail/compose");

	return result;
}

export async function saveDraftAction(formData: {
	draftId?: string;
	from: string;
	to?: string;
	subject?: string;
	text?: string;
}) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	const from = formData.from.trim().toLowerCase();
	if (!from) {
		throw new Error("From address is required.");
	}

	const db = getDb();
	const isOwner = await db
		.select({ emailAddress: userEmails.emailAddress })
		.from(userEmails)
		.where(and(eq(userEmails.userId, session.user.id), eq(userEmails.emailAddress, from)))
		.limit(1)
		.all();
	if (isOwner.length === 0) {
		throw new Error("You do not own this email address.");
	}

	const now = new Date().toISOString();
	const payload = {
		to_addr: formData.to?.trim() || null,
		subject: formData.subject?.trim() || null,
		text: formData.text?.trim() || null,
		updated_at: now,
	};

	const draftId = formData.draftId?.trim();
	if (draftId) {
		await db
			.update(draftEmails)
			.set(payload)
			.where(
				and(
					eq(draftEmails.id, draftId),
					eq(draftEmails.userId, session.user.id),
					eq(draftEmails.from_addr, from)
				)
			)
			.run();

		const row = await db
			.select({ id: draftEmails.id })
			.from(draftEmails)
			.where(and(eq(draftEmails.id, draftId), eq(draftEmails.userId, session.user.id)))
			.limit(1)
			.all();
		if (row.length > 0) {
			revalidatePath("/mail");
			return { draftId };
		}
	}

	const newDraftId = crypto.randomUUID();
	await db
		.insert(draftEmails)
		.values({
			id: newDraftId,
			userId: session.user.id,
			from_addr: from,
			...payload,
		})
		.run();

	revalidatePath("/mail");
	return { draftId: newDraftId };
}
