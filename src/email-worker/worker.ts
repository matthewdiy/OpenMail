import { and, eq, lt } from "drizzle-orm";
import { parseRawEmailBuffer, stripHtml } from "../lib/email-parser";
import { getDb } from "../lib/db";
import { emails, settings, userEmails } from "../lib/schema";
import { classifyEmail } from "./llm-classifier";

function extractSnippet(rawText: string) {
	const preview = rawText.replace(/\s+/g, " ").trim();
	return preview.length > 240 ? `${preview.slice(0, 237)}...` : preview;
}

export async function email(
	message: ForwardableEmailMessage,
	env: CloudflareEnv,
	_ctx: ExecutionContext
) {
	const id = crypto.randomUUID();
	const receivedAt = new Date().toISOString();

	const headers = message.headers;
	const rawSubject = headers.get("subject");
	const messageId = headers.get("message-id");

	const rawBuffer = await new Response(message.raw).arrayBuffer();
	const r2Key = `emails/${id}.eml`;
	await env.MAIL_R2.put(r2Key, rawBuffer, {
		httpMetadata: {
			contentType: "message/rfc822",
		},
	});

	const previewText = new TextDecoder().decode(rawBuffer.slice(0, 50_000));
	let from = message.from;
	let to = message.to;
	let subject = rawSubject;
	let textSegment = previewText.split(/\r?\n\r?\n/).slice(1).join("\n\n").trim();
	try {
		const parsed = await parseRawEmailBuffer(rawBuffer);
		if (parsed.from?.trim()) {
			from = parsed.from.trim();
		}
		if (parsed.to?.trim()) {
			to = parsed.to.trim();
		}
		if (parsed.subject?.trim()) {
			subject = parsed.subject.trim();
		}
		const parsedText = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : "").trim();
		if (parsedText) {
			textSegment = parsedText;
		}
	} catch (error) {
		console.error("Failed to parse raw email with postal-mime:", error);
	}
	const snippet = extractSnippet(textSegment);

	const db = getDb(env);
	const normalizedRecipient = to.trim().toLowerCase();

	const userEmailRows = await db
		.select()
		.from(userEmails)
		.where(eq(userEmails.emailAddress, normalizedRecipient))
		.limit(1)
		.all();
	const userAssocId = userEmailRows[0] ? userEmailRows[0].userId : null;

	await db
		.insert(emails)
		.values({
			id,
			userId: userAssocId,
			message_id: messageId,
			from_addr: from,
			to_addr: to,
			subject,
			received_at: receivedAt,
			r2_key: r2Key,
			size_bytes: rawBuffer.byteLength,
			snippet: snippet || null,
		})
		.run();

	const settingRows = await db
		.select()
		.from(settings)
		.where(eq(settings.key, "email_categories"))
		.limit(1)
		.all();
	const categories = settingRows[0] ? settingRows[0].value : "Inbox, Social, Promotion";

	try {
		const classification = await classifyEmail({
			categories,
			subject,
			from,
			body: textSegment.slice(0, 4000),
		});
		console.log(classification);
		await db
			.update(emails)
			.set({
				verification_code: classification.verification_code,
				summary: classification.summary,
				category: classification.category,
			})
			.where(eq(emails.id, id))
			.run();
	} catch (e) {
		console.error("Failed to parse LLM response:", e);
	}
}

export default {
	email,
	scheduled: async (
		_event: { cron: string; scheduledTime: number },
		env: CloudflareEnv,
		_ctx: ExecutionContext
	) => {
		const db = getDb(env);
		const settingRows = await db
			.select()
			.from(settings)
			.where(eq(settings.key, "trash_expire_days"))
			.limit(1)
			.all();
		const days = settingRows[0] ? parseInt(settingRows[0].value) : 30;

		const thresholdDate = new Date();
		thresholdDate.setDate(thresholdDate.getDate() - days);

		await db
			.delete(emails)
			.where(
				and(
					eq(emails.deleted, true),
					lt(emails.deleted_at, thresholdDate.toISOString())
				)
			)
			.run();
	},
};
