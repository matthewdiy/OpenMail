import { getDb } from "./lib/db";
import { emails, settings, userEmails } from "./lib/schema";
import { and, eq, lt } from "drizzle-orm";
import { ChatOpenAI } from "@langchain/openai";
import { parseRawEmailBuffer, stripHtml } from "./lib/email-parser";


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
	const subject = headers.get("subject");
	const messageId = headers.get("message-id");

	const rawBuffer = await new Response(message.raw).arrayBuffer();
	const r2Key = `emails/${id}.eml`;
	await env.MAIL_R2.put(r2Key, rawBuffer, {
		httpMetadata: {
			contentType: "message/rfc822",
		},
	});

	const previewText = new TextDecoder().decode(rawBuffer.slice(0, 50_000));
	let textSegment = previewText.split(/\r?\n\r?\n/).slice(1).join("\n\n").trim();
	try {
		const parsed = await parseRawEmailBuffer(rawBuffer);
		const parsedText = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : "").trim();
		if (parsedText) {
			textSegment = parsedText;
		}
	} catch (error) {
		console.error("Failed to parse raw email with postal-mime:", error);
	}
	const snippet = extractSnippet(textSegment);

	const db = getDb(env);
	const normalizedRecipient = message.to.trim().toLowerCase();

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
			from_addr: message.from,
			to_addr: message.to,
			subject,
			received_at: receivedAt,
			r2_key: r2Key,
			size_bytes: rawBuffer.byteLength,
			snippet: snippet || null,
		})
		.run();


	const settingRows = await db.select().from(settings).where(eq(settings.key, "email_categories")).limit(1).all();
	const categories = settingRows[0] ? settingRows[0].value : "Inbox, Social, Promotion";

	const model = new ChatOpenAI({
		model: "@cf/zai-org/glm-4.7-flash",
		topP: 0.05,
		apiKey: process.env.CLOUDFLARE_AI_API_TOKEN,
		configuration: {
			baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_AI_ACCOUNT_ID}/ai/v1`,
		},
	});

	const prompt = `Analyze the following email.
Available Categories: [${categories}]

Output format MUST be a strict JSON matching this structure:
{
  "verification_code": "STRING OR NULL (set it only if this is a verification email which provides a code)",
  "summary": "STRING (1 short sentence describing the email)",
  "category": "STRING (must be one of the available categories)"
}

Email Content:
Subject: ${subject || "No Subject"}
From: ${message.from}
Body:
${snippet || textSegment.slice(0, 1000)}
`;
	console.log(prompt)

	try {
		const response = await model.invoke(prompt);
		const resultText = response.content as string;
		const jsonMatch = resultText.match(/\{[\s\S]*\}/);
		const jsonString = jsonMatch ? jsonMatch[0] : resultText;
		const json = JSON.parse(jsonString);
		console.log(json)
		await db.update(emails)
			.set({
				verification_code: json.verification_code || null,
				summary: json.summary || null,
				category: json.category || null,
			})
			.where(eq(emails.id, id))
			.run();
	} catch (e) {
		console.error("Failed to parse LLM response:", e);
	}
}

export default {
	email,
	scheduled: async (event: { cron: string; scheduledTime: number }, env: CloudflareEnv, ctx: ExecutionContext) => {
		const db = getDb(env);
		const settingRows = await db.select().from(settings).where(eq(settings.key, "trash_expire_days")).limit(1).all();
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
	}
};
